// @vitest-environment happy-dom
// Spec: k.testing, Conformance "On one ctx, a save through `renderRoute` is read by `createApp`, and a save through `createApp` by the next `renderRoute` navigation."
// Spec: k.server Server state: the saved copy is one per `ctx.storage`, shared by every `createApp` and harness render on that ctx; a stale save is 409 `keel.conflict`.
// Seed: 1337.
// Skipped until the implementation exists (rfc:0093).
// ASSUMPTIONS (spec names no shape): a harness submit is `fire(inputId, { type: 'input', value })` then `fire(formId, { type: 'submit' })`;
// `createApp` is read through a runtime (JSON) GET and written through a runtime (JSON) POST; the loader's `Result` JSON is `{ ok, value }`.
import type { Ctx } from "@keel/ctx";
import { Form, action, loader, manifest } from "@keel/router";
import type { RouteProps } from "@keel/router";
import { text } from "@keel/runtime-dom/ops";
import { createCtx } from "@keel/ctx";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";

const Notes = s.object({ items: s.array(s.string()) });
const Add = s.object({ text: s.string() });

const factory = () => {
  const notes = store(Notes, { items: [] }, { id: "sc.notes" });
  const add = transaction(notes, "sc.add", Add, (state, { text: t }) => ({ items: [...state.items, t] }));
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

const links = manifest({ "link.sc": { path: "/sc", component: () => el("p", "link.sc") } });
const page = (props: RouteProps): Node => {
  const main = el("main", "sc.page");
  const list = el("p", "sc.items");
  text(list, () => itemsOf(props.data).join(","));
  const input = el("input", "sc.text");
  input.setAttribute("name", "text");
  const button = el("button", "sc.save");
  button.setAttribute("type", "submit");
  button.textContent = "save";
  const form = Form({ method: "POST", action: links.href("link.sc"), children: () => [input, button] });
  form.id = "sc.form";
  main.append(list, form);
  return main;
};
const read = loader({ output: Notes, stores: factory }, async ({ stores }) =>
  ok({ items: [...stores.notes.get("items")] }),
);
const write = action({ input: Add, stores: factory }, async ({ text: t }, { stores }) => {
  tx(stores.add, { text: t });
  return ok(null);
});
const routes = manifest({
  "sc.page": { path: "/sc", loader: read, component: page },
  "sc.other": { path: "/other", component: () => el("p", "sc.other") },
});
routes.actions({ "sc.page": { POST: write } });

const word = fc.stringMatching(/^[a-z]{1,8}$/);

const appOn = (ctx: Ctx) =>
  createApp({
    topology: topology({ web: { modules: ["sc"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
  });
type App = Awaited<ReturnType<typeof appOn>>;
const getItems = async (app: App): Promise<readonly string[]> => {
  const res = await app.fetch(new Request("http://localhost/sc", { headers: { accept: "application/json" } }));
  expect(res.status).toBe(200);
  const body: unknown = await res.json();
  const value: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "value") : undefined;
  return itemsOf(value);
};
const postText = (app: App, t: string): Promise<Response> =>
  app.fetch(
    new Request("http://localhost/sc", {
      method: "POST",
      body: JSON.stringify({ text: t }),
      headers: { accept: "application/json", "content-type": "application/json", origin: "http://localhost" },
    }),
  );

test.skip("On one ctx, a save through `renderRoute` is read by `createApp`, and a save through `createApp` by the next `renderRoute` navigation", async () => {
  await fc.assert(
    fc.asyncProperty(word, word, async (viaHarness, viaApp) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      const app = await appOn(ctx);
      const h = await renderRoute("sc.page", { routes, ctx });
      await h.fire("sc.text", { type: "input", value: viaHarness });
      await h.fire("sc.form", { type: "submit" });
      expect(await getItems(app)).toEqual([viaHarness]);
      expect((await postText(app, viaApp)).status).toBe(200);
      await h.navigate(routes.href("sc.other"));
      await h.navigate(routes.href("sc.page"));
      expect(h.find("sc.items").text).toBe([viaHarness, viaApp].join(","));
      h.dispose();
    }),
    { seed: 1337, numRuns: 10 },
  );
});

test.skip("two `createApp`s and a harness render on one ctx read each other's saves", async () => {
  await fc.assert(
    fc.asyncProperty(word, word, async (a, b) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      const one = await appOn(ctx);
      const two = await appOn(ctx);
      expect((await postText(one, a)).status).toBe(200);
      expect(await getItems(two)).toEqual([a]);
      expect((await postText(two, b)).status).toBe(200);
      const h = await renderRoute("sc.page", { routes, ctx });
      expect(h.find("sc.items").text).toBe([a, b].join(","));
      h.dispose();
    }),
    { seed: 1337, numRuns: 10 },
  );
});
