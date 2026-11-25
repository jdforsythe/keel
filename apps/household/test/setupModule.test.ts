import { createCtx } from "@keel/ctx";
import { routeTable } from "@keel/router";
import { tx } from "@keel/store";
import { properties, renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { routes as appRoutes } from "../modules/app/routes.ts";
import { routes as membersRoutes } from "../modules/members/routes.ts";
import { routes as receiptsRoutes } from "../modules/receipts/routes.ts";
import { Household } from "../modules/setup/Household.schema.ts";
import { SetupData } from "../modules/setup/SetupData.schema.ts";
import { SetupForm } from "../modules/setup/SetupForm.schema.ts";
import SetupPage from "../modules/setup/SetupPage.tsx";
import { SetupSearch } from "../modules/setup/SetupSearch.schema.ts";
import { frameStores } from "../modules/setup/frameStores.server.ts";
import { getHousehold } from "../modules/setup/getHousehold.server.ts";
import { householdStores } from "../modules/setup/householdStores.ts";
import { loadSetup } from "../modules/setup/loadSetup.server.ts";
import { routes as setupRoutes } from "../modules/setup/routes.ts";
import { saveSetup } from "../modules/setup/saveSetup.server.ts";
import { setup } from "../modules/setup/setup.contract.ts";
import { routes as shoppingRoutes } from "../modules/shopping/routes.ts";
import { must } from "./must.ts";
import { acceptsGenerated, rejectsAt, survivesJson } from "./schemas.ts";
import { served, webRoutes } from "./serve.ts";
import { using } from "./using.ts";

const table = routeTable(appRoutes, membersRoutes, receiptsRoutes, setupRoutes, shoppingRoutes);
const named = (name: string) => {
  const r = SetupForm.parse({ name });
  if (!r.ok) throw new Error(`not a household name: ${name}`);
  return r.value;
};
const at = (url = "http://localhost/setup", user = "u1") => ({ params: {}, search: {}, url, caller: "c1", user });

it("holds a household's name as a line of at most 40 characters, or none yet", () => {
  expect(Household.parse({ name: null }).ok).toBe(true);
  expect(Household.parse({ name: "Elm Street" }).ok).toBe(true);
  expect(Household.parse({ name: "x".repeat(40) }).ok).toBe(true);
  rejectsAt(Household, { name: "x".repeat(41) }, "name");
  rejectsAt(Household, { name: "two\nlines" }, "name");
  rejectsAt(Household, {}, "name");
  rejectsAt(SetupForm, { name: "y".repeat(41) }, "name");
  rejectsAt(SetupForm, {}, "name");
  expect(SetupForm.parse({ name: "Elm Street" }).ok).toBe(true);
  expect(SetupSearch.parse({}).ok).toBe(true);
  expect(SetupSearch.parse({ next: "/list" }).ok).toBe(true);
  rejectsAt(SetupSearch, { next: 3 }, "next");
});

it("generates household, form, search and page data that parse and survive the wire", () => {
  for (const schema of [Household, SetupForm, SetupSearch, SetupData]) {
    acceptsGenerated(schema, 50);
    survivesJson(schema, 50);
  }
});

it("keeps the household's name in a store that starts empty and changes through one transaction", () =>
  using(householdStores, (stores) => {
    expect(stores.household.get("name")).toBeNull();
    expect(tx(stores.name, named("Elm Street")).ok).toBe(true);
    expect(stores.household.get("name")).toBe("Elm Street");
    expect(tx(stores.name, named("Oak Road")).ok).toBe(true);
    expect(stores.household.get("name")).toBe("Oak Road");
    expect(stores.household.undo()).toBe(true);
    expect(stores.household.get("name")).toBe("Elm Street");
  }));

it("opens the household and the weekly runs together for the frame and the setup page", () =>
  using(
    () => frameStores(createCtx({ mode: "sim", seed: 130 })),
    (stores) => {
      expect(Object.keys(stores).sort()).toEqual(["household", "name", "restock"]);
      expect(stores.household.get("name")).toBeNull();
      expect(stores.restock.store.get("instances")).toEqual({});
    },
  ));

it("answers the household API with the name on the stores it was given, and null before setup", async () => {
  const ctx = createCtx({ mode: "sim", seed: 131 });
  await using(householdStores, async (stores) => {
    expect(await getHousehold.run({ ...at(), stores }, ctx)).toEqual({ ok: true, value: { name: null } });
    must(tx(stores.name, named("Elm Street")));
    expect(await getHousehold.run({ ...at(), stores }, ctx)).toEqual({ ok: true, value: { name: "Elm Street" } });
  });
});

it("loads the setup page's words, the current name and the latest run", async () => {
  const ctx = createCtx({ mode: "sim", seed: 132 });
  await using(
    () => frameStores(ctx),
    async (stores) => {
      const loaded = await loadSetup.run({ ...at(), stores }, ctx);
      expect(loaded).toMatchObject({
        ok: true,
        value: { heading: "Set up your household", current: null, runs: { last: null, kept: 0 } },
      });
      expect(loaded.ok && SetupData.parse(loaded.value).ok).toBe(true);
      must(tx(stores.name, named("Elm Street")));
      expect(await loadSetup.run({ ...at(), stores }, ctx)).toMatchObject({
        ok: true,
        value: { current: "Elm Street" },
      });
    },
  );
});

it("saves the name and goes back to the page the guard named, if it is one of this app's pages, else stays", async () => {
  const ctx = createCtx({ mode: "sim", seed: 133 });
  const run = (url: string) =>
    using(householdStores, async (stores) => {
      const r = await saveSetup.run(
        { name: "Elm Street" },
        { params: {}, url, caller: "c1", user: "u1", stores, routes: table },
        ctx,
      );
      return { r, name: stores.household.get("name") };
    });
  expect(await run("http://localhost/setup")).toEqual({ r: { ok: true, value: null }, name: "Elm Street" });
  expect(await run("http://localhost/setup?next=%2Flist")).toEqual({
    r: { ok: true, value: "/list" },
    name: "Elm Street",
  });
  expect((await run("http://localhost/setup?next=%2Fde-DE%2Freceipts")).r).toEqual({
    ok: true,
    value: "/de-DE/receipts",
  });
  for (const next of ["https%3A%2F%2Fevil.example%2F", "%2F%2Fevil.example", "%2Fnowhere", "%2Fapi%2Fitems"])
    expect((await run(`http://localhost/setup?next=${next}`)).r).toEqual({ ok: true, value: null });
});

it("leaves the setup page's contract with one page and one API read", () => {
  expect(Object.keys(setup.entries)).toEqual(["setup.form", "setup.household"]);
  expect(setup.href("setup.form", {}, { next: "/list" })).toBe("/setup?next=%2Flist");
});

it("shows a member the setup form: heading, labelled name field, save, no done notice before the first save", async () => {
  const at = await served(134);
  const page = await renderRoute("setup.form", {
    routes: webRoutes,
    params: {},
    ctx: at.ctx,
    app: at.app,
    user: at.user,
  });
  expect(page.find("setup.heading")).toMatchObject({ role: "heading", name: "Set up your household" });
  expect(page.find("setup.form:name")).toMatchObject({ role: "textbox", name: "Household name" });
  expect(page.find("setup.save")).toMatchObject({ role: "button", name: "Save" });
  expect(() => page.find("setup.done")).toThrow();
  expect(page.focusOrder().slice(5, 8)).toEqual([
    "setup.form:name",
    "setup.save",
    expect.stringMatching(/^shopping\./),
  ]);
  page.dispose();
});

it("refuses an empty name and a name over 40 characters in the form, and saves nothing", async () => {
  const at = await served(135);
  const page = await renderRoute("setup.form", {
    routes: webRoutes,
    params: {},
    ctx: at.ctx,
    app: at.app,
    user: at.user,
  });
  await page.fire("setup.save", { type: "click" });
  expect(page.find("setup.form:name").state).toMatchObject({ invalid: true });
  await page.fire("setup.form:name", { type: "input", value: "x".repeat(41) });
  await page.fire("setup.save", { type: "click" });
  expect(page.find("setup.form:name").state).toMatchObject({ invalid: true });
  expect(() => page.find("setup.done")).toThrow();
  expect(page.find("setup.form:name").state).not.toMatchObject({ focused: false, invalid: false });
  page.dispose();
});

it("saves the name, shows the done notice, and sends the member back to the page the guard named", async () => {
  const at = await served(136);
  const stay = await renderRoute("setup.form", {
    routes: webRoutes,
    params: {},
    ctx: at.ctx,
    app: at.app,
    user: at.user,
  });
  await stay.fire("setup.form:name", { type: "input", value: "Elm Street" });
  await stay.fire("setup.save", { type: "click" });
  expect(stay.route().id).toBe("setup.form");
  expect(stay.find("setup.done").text).toContain("The household is set up");
  expect(stay.find("frame.name").text).toBe("Elm Street");
  stay.dispose();
  const next = await renderRoute("setup.form", {
    routes: webRoutes,
    params: {},
    search: { next: "/list" },
    ctx: at.ctx,
    app: at.app,
    user: at.user,
  });
  await next.fire("setup.form:name", { type: "input", value: "Oak Road" });
  await next.fire("setup.save", { type: "click" });
  expect(next.route().id).toBe("shopping.list");
  expect(next.find("frame.name").text).toBe("Oak Road");
  next.dispose();
});

it("sends a visitor from the setup page to sign in, naming setup as the page to return to", async () => {
  const at = await served(137, false);
  const page = await renderRoute("setup.form", { routes: webRoutes, params: {}, ctx: at.ctx, app: at.app });
  expect(page.route()).toMatchObject({ id: "members.signin", search: { next: "/setup" } });
  page.dispose();
});

it("renders the setup page for any copy, name and run the schemas allow", async () => {
  await properties(SetupPage, { runs: 100, seed: 31 });
});
