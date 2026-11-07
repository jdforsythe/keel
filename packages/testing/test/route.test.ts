// @vitest-environment happy-dom
// Spec: k.testing Harness (`renderRoute`) with k.router manifests, navigation, and Form actions. Seed: 1337.
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { Form, type Href, action, loader, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";

let made: { readonly value: ReturnType<typeof makeStore> } | undefined;
function makeStore() {
  return store(s.object({ titles: s.array(s.string()) }), { titles: [] }, { id: "test.notesList" });
}
scope(() => {
  made = { value: makeStore() };
});
const list = made?.value;
if (list === undefined) throw new Error("test: scope did not run");
const add = transaction(list, "test.addNote", s.object({ title: s.string() }), (st, { title }) => ({
  titles: [...st.titles, title],
}));

const el = (tag: string, attrs: Record<string, string>, text?: string): HTMLElement => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
};

const loads = { n: 0 };
const routes = manifest({
  "rt.list": {
    path: "/rt",
    loader: loader({ output: s.object({ count: s.int() }) }, async () => {
      loads.n++;
      return ok({ count: list.snapshot().state.titles.length });
    }),
    actions: {
      POST: action({ input: s.object({ title: s.string() }) }, async ({ title }) => {
        tx(add, { title });
        const to: Href = routes.href("rt.show", { n: list.snapshot().state.titles.length });
        return ok(to);
      }),
    },
    component: (props) => {
      const root = el("main", { id: "rt.main" });
      const data: unknown = props.data;
      const count = typeof data === "object" && data !== null ? Reflect.get(data, "count") : undefined;
      root.append(el("p", { id: "rt.count" }, `count ${String(count)}`));
      const label = el("label", { for: "rt.title" }, "Title");
      const input = el("input", { id: "rt.title", name: "title" });
      const submit = el("button", { id: "rt.save", type: "submit" }, "Save");
      const form = Form({ method: "POST", action: "rt.list", children: [label, input, submit] });
      form.setAttribute("id", "rt.form");
      root.append(form);
      return root;
    },
  },
  "rt.show": {
    path: "/rt/:n",
    params: s.object({ n: s.int() }),
    component: (props) => {
      const n = typeof props.params === "object" && props.params !== null ? Reflect.get(props.params, "n") : undefined;
      return el("h1", { id: "rt.heading" }, `note ${String(n)}`);
    },
  },
});

const sim = () => createCtx({ mode: "sim", seed: 1337 });

describe("renderRoute renders a route of a manifest", () => {
  it("resolves when the page is ready: the loader ran once and its data is rendered", async () => {
    loads.n = 0;
    const t = await renderRoute("rt.list", { routes, state: [[list, { titles: ["a", "b"] }]], ctx: sim() });
    expect(t.route()).toEqual({ id: "rt.list", params: {}, search: {}, pending: false });
    expect(t.find("rt.count").text).toBe("count 2");
    expect(loads.n).toBe(1);
    t.dispose();
    expect(list.snapshot().state.titles).toEqual([]);
  });

  it("renders a route with params", async () => {
    const t = await renderRoute("rt.show", { routes, params: { n: 7 }, ctx: sim() });
    expect(t.route()).toMatchObject({ id: "rt.show", params: { n: 7 } });
    expect(t.find("rt.heading")).toMatchObject({ role: "heading", name: "note 7" });
    t.dispose();
  });

  it("a Form submit fired by id runs the action and follows its navigation", async () => {
    const t = await renderRoute("rt.list", { routes, state: [[list, { titles: [] }]], ctx: sim() });
    await t.fire("rt.title", { type: "input", value: "first" });
    await t.fire("rt.form", { type: "submit" });
    expect(t.state(list).titles).toEqual(["first"]);
    expect(t.route()).toMatchObject({ id: "rt.show", params: { n: 1 }, pending: false });
    expect(t.find("rt.heading").name).toBe("note 1");
    t.dispose();
  });
});
