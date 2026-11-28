// @vitest-environment happy-dom
// Property seed: 1337. A keyed row of a server-rendered, resumed list keeps its server-rendered element (and so
// focus) when `each` is replaced by new objects with the same keys, and across an insert and a removal.
import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { clone, list, resume, template, text } from "../src/ops/index.ts";
import { SEED, rootSignal } from "./support.ts";
import { testCtx } from "./testCtx.ts";

type Todo = { readonly id: string; readonly title: string };

const ISLAND = template('<div data-k-island="T"><ul><!----></ul></div>');
const LI = template("<li><button></button></li>");

const items = rootSignal<Todo[]>([]);

/** The island: a keyed list whose rows read their item through a getter, as the compiler emits them. */
const T = (): Node => {
  const root = clone(ISLAND);
  const ul = root.querySelector("ul");
  if (ul === null || ul.lastChild === null) throw new Error("fixture");
  list(
    ul.lastChild,
    () => items.get(),
    (t) => t.id,
    (todo) => {
      const li = clone(LI);
      if (!(li instanceof HTMLElement)) throw new Error("no li");
      li.id = `row.${todo().id}`;
      const button = li.firstChild;
      if (button === null) throw new Error("no button");
      text(button, () => todo().title);
      return li;
    },
  );
  return root;
};

const serverHtml = (ts: readonly Todo[]): string =>
  `<div data-k-island="T"><ul><!--[-->${ts
    .map((t) => `<li id="row.${t.id}"><button>${t.title}</button></li>`)
    .join(
      "",
    )}<!--]--><!----></ul></div><script type="application/json" id="k-state">${JSON.stringify({ stores: {}, islands: { T: {} } })}</script>`;

const todos = (spec: readonly string[], v = 0): Todo[] => spec.map((id) => ({ id, title: `${id}${v}` }));
const rowOf = (host: Element, id: string): HTMLElement => {
  const el = host.querySelector(`[id="row.${id}"]`);
  if (!(el instanceof HTMLElement)) throw new Error(`no row ${id}`);
  return el;
};
const titles = (host: Element): string[] => [...host.querySelectorAll("button")].map((b) => b.textContent ?? "");

let host: HTMLElement = document.createElement("div");
afterEach(() => host.remove());
const resumed = (initial: Todo[]): void => {
  host = document.createElement("div");
  document.body.appendChild(host);
  host.innerHTML = serverHtml(initial);
  items.set(initial);
  const { warnings } = resume(host, { T }, { ctx: testCtx });
  expect(warnings).toEqual([]);
};

describe("keyed list after resume: a surviving key keeps its server-rendered element", () => {
  it("new objects with the same keys keep every row element and the focus; the changed row's text updates", () => {
    resumed(todos(["a", "b"]));
    const a = rowOf(host, "a");
    const b = rowOf(host, "b");
    const focused = b.querySelector("button");
    if (focused === null) throw new Error("no button");
    focused.focus();
    expect(document.activeElement).toBe(focused);
    items.set([
      { id: "a", title: "a1" },
      { id: "b", title: "b0" },
    ]);
    expect(rowOf(host, "a")).toBe(a);
    expect(rowOf(host, "b")).toBe(b);
    expect(document.activeElement).toBe(focused);
    expect(titles(host)).toEqual(["a1", "b0"]);
  });

  it("over any keys and new values, every server-rendered row element and the focus survive", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.constantFrom(..."abcdef"), { minLength: 1, maxLength: 6 }), fc.nat(9), (ks, v) => {
        resumed(todos(ks));
        const rows = ks.map((k) => rowOf(host, k));
        const focused = rows[0]?.querySelector("button");
        if (focused === null || focused === undefined) throw new Error("no button");
        focused.focus();
        items.set(todos(ks, v + 1));
        ks.forEach((k, i) => expect(rowOf(host, k)).toBe(rows[i]));
        expect(document.activeElement).toBe(focused);
        expect(titles(host)).toEqual(ks.map((k) => `${k}${v + 1}`));
        host.remove();
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("an insert and a removal leave the other rows' elements identical", () => {
    resumed(todos(["a", "b", "c"]));
    const a = rowOf(host, "a");
    const c = rowOf(host, "c");
    const focused = a.querySelector("button");
    if (focused === null) throw new Error("no button");
    focused.focus();
    items.set(todos(["a", "b", "d", "c"]));
    expect(rowOf(host, "a")).toBe(a);
    expect(rowOf(host, "c")).toBe(c);
    expect(titles(host)).toEqual(["a0", "b0", "d0", "c0"]);
    const b = rowOf(host, "b");
    items.set(todos(["a", "b", "d"]));
    expect(rowOf(host, "a")).toBe(a);
    expect(rowOf(host, "b")).toBe(b);
    expect(host.querySelector('[id="row.c"]')).toBeNull();
    expect(document.activeElement).toBe(focused);
    expect(titles(host)).toEqual(["a0", "b0", "d0"]);
  });
});
