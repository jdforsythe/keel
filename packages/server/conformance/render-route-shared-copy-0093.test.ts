// @vitest-environment happy-dom
// Spec: k.testing, clause "On one ctx, a save through `renderRoute` is read by `createApp`, and a save through `createApp` by the next `renderRoute` navigation."
// k.server Server state: the saved copy is one per `ctx.storage`, shared by every `createApp` and harness render on that ctx; a stale save is 409 `keel.conflict`.
// Seed: 1337.
// ASSUMPTIONS (spec names no shape): a harness submit is `fire(inputId, { type: 'input', value })` then `fire(formId, { type: 'submit' })`;
// `createApp` is read through a runtime (JSON) GET and written through a runtime (JSON) POST; the GET answers the envelope `{ id, results: { [id]: Result } }` and the route's `Result` is `{ ok, value }`.
// A stale read is `keel.conflict`: the harness holds its save while `createApp` saves on the same ctx.
import type { Ctx } from "@keel/ctx";
import { Form, action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import type { RouteProps } from "@keel/router";
import { text } from "@keel/runtime-dom/ops";
import { Input } from "@keel/ui";
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

const link = contract("link", {
  "link.sc": { path: "/sc" },
});

const links = manifest(link, {
  "link.sc": { component: () => el("p", "link.sc") },
});
const page = (props: RouteProps): Node => {
  const main = el("main", "sc.page");
  const list = el("p", "sc.items");
  text(list, () => itemsOf(props.data).join(","));
  const input = Input({ id: "sc.text", name: "text", label: "Text" });
  const button = el("button", "sc.save");
  button.setAttribute("type", "submit");
  button.textContent = "save";
  const form = Form({
    method: "POST",
    action: link.href("link.sc"),
    error: (e) => {
      const p = el("p", "sc.err");
      p.textContent = e.code;
      return p;
    },
    children: () => [input, button],
  });
  form.id = "sc.form";
  main.append(list, form);
  return main;
};
const scContract = contract("sc", {
  "sc.page": { path: "/sc" },
  "sc.other": { path: "/other" },
});

const read = loader(scContract, "sc.page", { output: Notes, stores: factory }, async ({ stores }) =>
  ok({ items: [...stores.notes.get("items")] }),
);
const control: { hold: Promise<void> | null; arrived: (() => void) | null } = { hold: null, arrived: null };
const write = action(scContract, "sc.page", { input: Add, stores: factory }, async ({ text: t }, { stores }) => {
  const hold = control.hold;
  control.hold = null;
  tx(stores.add, { text: t });
  control.arrived?.();
  if (hold !== null) await hold;
  return ok(null);
});
const routes = manifest(scContract, {
  "sc.page": { loader: read, component: page, POST: write },
  "sc.other": { component: () => el("p", "sc.other") },
});

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
  const results: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "results") : undefined;
  const result: unknown = typeof results === "object" && results !== null ? Reflect.get(results, "sc.page") : undefined;
  const value: unknown = typeof result === "object" && result !== null ? Reflect.get(result, "value") : undefined;
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

test("On one ctx, a save through `renderRoute` is read by `createApp`, and a save through `createApp` by the next `renderRoute` navigation", async () => {
  await fc.assert(
    fc.asyncProperty(word, word, async (viaHarness, viaApp) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      const app = await appOn(ctx);
      const h = await renderRoute("sc.page", { routes, ctx });
      await h.fire("sc.text", { type: "input", value: viaHarness });
      await h.fire("sc.form", { type: "submit" });
      expect(await getItems(app)).toEqual([viaHarness]);
      expect((await postText(app, viaApp)).status).toBe(200);
      await h.navigate(scContract.href("sc.other"));
      await h.navigate(scContract.href("sc.page"));
      expect(h.find("sc.items").text).toBe([viaHarness, viaApp].join(","));
      h.dispose();
    }),
    { seed: 1337, numRuns: 10 },
  );
});

test("two `createApp`s and a harness render on one ctx read each other's saves", async () => {
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

test("a stale save is 409 `keel.conflict`: the harness's held save answers the error and only `createApp`'s save is stored", async () => {
  await fc.assert(
    fc.asyncProperty(word, word, async (first, second) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      const app = await appOn(ctx);
      const h = await renderRoute("sc.page", { routes, ctx });
      let release: () => void = () => undefined;
      control.hold = new Promise<void>((r) => {
        release = r;
      });
      const arrived = new Promise<void>((r) => {
        control.arrived = r;
      });
      await h.fire("sc.text", { type: "input", value: first });
      const pending = h.fire("sc.form", { type: "submit" });
      await arrived;
      control.arrived = null;
      expect((await postText(app, second)).status).toBe(200);
      release();
      await pending;
      expect(h.find("sc.err").text).toBe("keel.conflict");
      expect(await getItems(app)).toEqual([second]);
      h.dispose();
    }),
    { seed: 1337, numRuns: 8 },
  );
});

test("a mounted harness navigates away and back after `createApp` saved on its ctx, and shows the new save without a submit of its own", async () => {
  await fc.assert(
    fc.asyncProperty(word, word, async (first, second) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      const app = await appOn(ctx);
      expect((await postText(app, first)).status).toBe(200);
      const h = await renderRoute("sc.page", { routes, ctx });
      expect(h.find("sc.items").text).toBe(first);
      expect((await postText(app, second)).status).toBe(200);
      await h.navigate(scContract.href("sc.other"));
      await h.navigate(scContract.href("sc.page"));
      expect(h.find("sc.items").text).toBe([first, second].join(","));
      h.dispose();
    }),
    { seed: 1337, numRuns: 10 },
  );
});
