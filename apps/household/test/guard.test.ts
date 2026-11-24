import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { asJson, formPost, served, webRoutes } from "./serve.ts";

it("sends the list to sign-in, naming it, until a member signs in", async () => {
  const anon = await served(4, false);
  const before = await renderRoute("shopping.list", { routes: webRoutes, params: {}, ctx: anon.ctx, app: anon.app });
  expect(before.route().id).toBe("members.signin");
  expect(before.route().search).toEqual({ next: "/list" });
  expect(before.find("members.signin.heading").text).toBe("Sign in");
  before.dispose();
  const { ctx, app, user } = await served(4);
  const after = await renderRoute("shopping.list", { routes: webRoutes, params: {}, ctx, app, user });
  expect(after.route().id).toBe("shopping.list");
  after.dispose();
});

it("guards the receipts book in every locale", async () => {
  const { ctx, app } = await served(4, false);
  const page = await renderRoute("receipts.book", { routes: webRoutes, params: { locale: "de-DE" }, ctx, app });
  expect(page.route()).toMatchObject({ id: "members.signin", search: { next: "/de-DE/receipts" } });
  page.dispose();
});

it("guards the setup page", async () => {
  const { ctx, app } = await served(4, false);
  const page = await renderRoute("setup.form", { routes: webRoutes, params: {}, ctx, app });
  expect(page.route()).toMatchObject({ id: "members.signin", search: { next: "/setup" } });
  page.dispose();
});

it("refuses the API to a request no member made, and answers the member's token", async () => {
  const { raw, fetch } = await served(4);
  expect((await raw(asJson("GET", "/api/items"))).status).toBe(403);
  expect((await raw(asJson("POST", "/api/items", { name: "Milk" }))).status).toBe(403);
  expect((await raw(asJson("GET", "/api/household"))).status).toBe(403);
  expect((await fetch(asJson("GET", "/api/items"))).status).toBe(200);
});

it("answers the household API with null before setup and the name after", async () => {
  const { fetch } = await served(4);
  expect((await (await fetch(asJson("GET", "/api/household"))).json()).results["setup.household"]).toEqual({
    ok: true,
    value: { name: null },
  });
  expect((await fetch(formPost("/setup", { name: "Elm Street" }))).status).toBe(303);
  expect((await (await fetch(asJson("GET", "/api/household"))).json()).results["setup.household"]).toEqual({
    ok: true,
    value: { name: "Elm Street" },
  });
});

it("names the household on the setup page once a member is signed in", async () => {
  const { ctx, app, user } = await served(4);
  const page = await renderRoute("setup.form", { routes: webRoutes, params: {}, ctx, app, user });
  expect(page.route().id).toBe("setup.form");
  await page.fire("setup.form:name", { type: "input", value: "Elm Street" });
  await page.fire("setup.save", { type: "click" });
  expect(page.find("setup.done").text).toContain("set up");
  page.dispose();
});

it("follows the setup guard's next to a page of the app, and a hostile next lands on the setup page", async () => {
  const { fetch } = await served(37);
  const to = async (next: string) =>
    (await fetch(formPost(`/setup?next=${encodeURIComponent(next)}`, { name: "Elm Street" }))).headers.get("location");
  expect(await to("/list")).toBe("/list");
  const stay = await to("/setup");
  expect(stay).not.toBeNull();
  for (const next of ["/\t/evil.example/x", "//evil.example", "https://evil.example/", "/\\evil.example"])
    expect(await to(next)).toBe(stay);
});
