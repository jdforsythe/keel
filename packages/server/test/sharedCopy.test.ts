// @vitest-environment happy-dom
// k.server Server state with k.testing `renderRoute`: the saved copy is one per `ctx.storage`, so a harness render
// and `createApp`s on one ctx read each other's saves, and a stale save through one app is 409 `keel.conflict`.
import { type Ctx, createCtx } from "@keel/ctx";
import { Form, action, loader, manifest } from "@keel/router";
import type { RouteProps } from "@keel/router";
import { text } from "@keel/runtime-dom/ops";
import { ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/createApp.ts";
import { topology } from "../src/topology.ts";

const Notes = s.object({ items: s.array(s.string()) });
const Add = s.object({ text: s.string() });
const gate: { hold: Promise<void> | null; arrived: (() => void) | null } = { hold: null, arrived: null };
const factory = () => {
  const notes = store(Notes, { items: [] }, { id: "cp.notes" });
  const add = transaction(notes, "cp.add", Add, (st, { text: t }) => ({ items: [...st.items, t] }));
  return { notes, add };
};
const el = (tag: string, id: string): HTMLElement => {
  const e = document.createElement(tag);
  e.id = id;
  return e;
};
const itemsOf = (data: unknown): readonly string[] => {
  const items: unknown = typeof data === "object" && data !== null ? Reflect.get(data, "items") : undefined;
  return Array.isArray(items) ? items.filter((i): i is string => typeof i === "string") : [];
};
const links = manifest({ "cp.link": { path: "/cp", component: () => el("p", "cp.link") } });
const page = (props: RouteProps): Node => {
  const main = el("main", "cp.page");
  const list = el("p", "cp.items");
  text(list, () => itemsOf(props.data).join(","));
  const input = el("input", "cp.text");
  input.setAttribute("name", "text");
  input.setAttribute("aria-label", "Note");
  const button = el("button", "cp.save");
  button.setAttribute("type", "submit");
  button.textContent = "Save";
  const form = Form({ method: "POST", action: links.href("cp.link"), children: () => [input, button] });
  form.id = "cp.form";
  main.append(list, form);
  return main;
};
const routes = manifest({
  "cp.page": {
    path: "/cp",
    loader: loader({ output: Notes, stores: factory }, async ({ stores }) =>
      ok({ items: [...stores.notes.get("items")] }),
    ),
    component: page,
  },
  "cp.other": { path: "/cp-other", component: () => el("p", "cp.other") },
});
routes.actions({
  "cp.page": {
    POST: action({ input: Add, stores: factory }, async ({ text: t }, { stores }) => {
      tx(stores.add, { text: t });
      gate.arrived?.();
      if (gate.hold !== null) await gate.hold;
      return ok(null);
    }),
  },
});

const appOn = (ctx: Ctx) =>
  createApp({ topology: topology({ web: { modules: ["cp"], adapter: "node" } }), routes, ctx, mode: "production" });
type App = Awaited<ReturnType<typeof appOn>>;
const itemsVia = async (app: App): Promise<readonly string[]> => {
  const res = await app.fetch(new Request("http://localhost/cp", { headers: { accept: "application/json" } }));
  const body: unknown = await res.json();
  const results: unknown = Reflect.get(Object(body), "results");
  return itemsOf(Reflect.get(Object(Reflect.get(Object(results), "cp.page")), "value"));
};
const post = (app: App, t: string): Promise<Response> =>
  app.fetch(
    new Request("http://localhost/cp", {
      method: "POST",
      body: JSON.stringify({ text: t }),
      headers: { accept: "application/json", "content-type": "application/json", origin: "http://localhost" },
    }),
  );

describe("one saved copy per ctx.storage", () => {
  it("a renderRoute save is read by createApp, and a createApp save by the next renderRoute navigation", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const app = await appOn(ctx);
    const h = await renderRoute("cp.page", { routes, ctx });
    await h.fire("cp.text", { type: "input", value: "harness" });
    await h.fire("cp.form", { type: "submit" });
    expect(await itemsVia(app)).toEqual(["harness"]);
    expect((await post(app, "app")).status).toBe(200);
    await h.navigate(routes.href("cp.other"));
    await h.navigate(routes.href("cp.page"));
    expect(h.find("cp.items").text).toBe("harness,app");
    h.dispose();
    await app.close();
  });

  it("two createApps on one ctx read each other's saves, and a stale save is 409 keel.conflict", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const one = await appOn(ctx);
    const two = await appOn(ctx);
    expect((await post(one, "a")).status).toBe(200);
    expect(await itemsVia(two)).toEqual(["a"]);
    let release = (): void => undefined;
    gate.hold = new Promise<void>((r) => {
      release = r;
    });
    const arrived = new Promise<void>((r) => {
      gate.arrived = r;
    });
    const slow = post(one, "slow");
    await arrived;
    gate.hold = null;
    gate.arrived = null;
    expect((await post(two, "quick")).status).toBe(200);
    release();
    const res = await slow;
    expect(res.status).toBe(409);
    expect(await itemsVia(one)).toEqual(["a", "quick"]);
    await one.close();
    await two.close();
  });
});
