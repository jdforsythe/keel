// @vitest-environment happy-dom
// Property seed: 1337. A keyed row whose key survives a replacement of `each` keeps its element (and so focus);
// its bindings update from the new item object. Rows are written the way the compiler emits them: a component
// receives the item through a getter prop and reads it at top level (its id) and in bindings (its text).
import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { For, mount } from "../src/index.ts";
import { clone, list, template, text } from "../src/ops/index.ts";
import { SEED, rootSignal } from "./support.ts";

type Todo = { readonly id: string; readonly title: string };

const UL = template("<ul><!----></ul>");
const LI = template("<li><button></button></li>");

/** A row component: `id` read once at top level, the title bound to the button's text. */
function Row(props: { readonly todo: Todo }): Node {
  const li = clone(LI);
  if (!(li instanceof HTMLElement)) throw new Error("no li");
  li.id = `row.${props.todo.id}`;
  const button = li.firstChild;
  if (button === null) throw new Error("no button");
  text(button, () => props.todo.title);
  return li;
}

function render(items: () => readonly Todo[], host: Element): () => void {
  return mount(() => {
    const ul = clone(UL);
    const anchor = ul.lastChild;
    if (anchor === null) throw new Error("no anchor");
    list(
      anchor,
      items,
      (t) => t.id,
      (todo) =>
        Row({
          get todo() {
            return todo();
          },
        }),
    );
    return ul;
  }, host);
}

const rowOf = (host: Element, id: string): HTMLElement => {
  const el = host.querySelector(`[id="row.${id}"]`);
  if (!(el instanceof HTMLElement)) throw new Error(`no row ${id}`);
  return el;
};
const buttonOf = (host: Element, id: string): HTMLElement => {
  const b = rowOf(host, id).querySelector("button");
  if (b === null) throw new Error(`no button ${id}`);
  return b;
};
const titles = (host: Element): string[] => [...host.querySelectorAll("button")].map((b) => b.textContent ?? "");
const todos = (spec: string): Todo[] => [...spec].map((id) => ({ id, title: `${id}0` }));

let host: HTMLElement = document.createElement("div");
afterEach(() => host.remove());
const setup = (initial: Todo[]): { items: ReturnType<typeof rootSignal<Todo[]>>; dispose: () => void } => {
  host = document.createElement("div");
  document.body.appendChild(host);
  const items = rootSignal<Todo[]>(initial);
  return { items, dispose: render(() => items.get(), host) };
};

describe("keyed list: a surviving key keeps its element", () => {
  it("new objects with the same keys: row B keeps its element and focus, row A's text updates", () => {
    const { items, dispose } = setup(todos("ab"));
    const a = rowOf(host, "a");
    const b = rowOf(host, "b");
    const focused = buttonOf(host, "b");
    focused.focus();
    expect(document.activeElement).toBe(focused);
    items.set([
      { id: "a", title: "a1" },
      { id: "b", title: "b0" },
    ]);
    expect(rowOf(host, "a")).toBe(a);
    expect(rowOf(host, "b")).toBe(b);
    expect(buttonOf(host, "b")).toBe(focused);
    expect(document.activeElement).toBe(focused);
    expect(titles(host)).toEqual(["a1", "b0"]);
    dispose();
  });

  it("reorder, insert and remove keep every surviving row's element; insert and remove keep the focus", () => {
    const { items, dispose } = setup(todos("abc"));
    const b = rowOf(host, "b");
    const c = rowOf(host, "c");
    const focused = buttonOf(host, "b");
    items.set([...todos("cb").map((t) => ({ ...t, title: `${t.id}2` }))]);
    expect(rowOf(host, "c")).toBe(c);
    expect(rowOf(host, "b")).toBe(b);
    expect(host.querySelector('[id="row.a"]')).toBeNull();
    expect(titles(host)).toEqual(["c2", "b2"]);
    focused.focus();
    items.set(todos("cdb"));
    expect(rowOf(host, "c")).toBe(c);
    expect(rowOf(host, "b")).toBe(b);
    expect(titles(host)).toEqual(["c0", "d0", "b0"]);
    expect(document.activeElement).toBe(focused);
    items.set(todos("db"));
    expect(rowOf(host, "b")).toBe(b);
    expect(document.activeElement).toBe(focused);
    dispose();
  });

  it("a key that leaves and comes back renders a new element", () => {
    const { items, dispose } = setup(todos("ab"));
    const a = rowOf(host, "a");
    items.set(todos("b"));
    items.set(todos("ab"));
    expect(rowOf(host, "a")).not.toBe(a);
    dispose();
  });

  it("over any sequence of keyed replacements, an element whose key survives is the same node", () => {
    const step = fc.tuple(fc.uniqueArray(fc.constantFrom(..."abcdef"), { maxLength: 6 }), fc.nat(9));
    fc.assert(
      fc.property(fc.array(step, { minLength: 1, maxLength: 10 }), (steps) => {
        const { items, dispose } = setup([]);
        let prev = new Map<string, Element>();
        for (const [ks, v] of steps) {
          items.set(ks.map((id) => ({ id, title: `${id}${v}` })));
          expect(titles(host)).toEqual(ks.map((id) => `${id}${v}`));
          const next = new Map<string, Element>();
          for (const k of ks) {
            const el = rowOf(host, k);
            if (prev.has(k)) expect(el).toBe(prev.get(k));
            next.set(k, el);
          }
          prev = next;
        }
        dispose();
        host.remove();
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("unkeyed (identity key): a new object is a new row", () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    const items = rootSignal<Todo[]>(todos("a"));
    const dispose = mount(() => {
      const ul = clone(UL);
      const anchor = ul.lastChild;
      if (anchor === null) throw new Error("no anchor");
      list(
        anchor,
        () => items.get(),
        (t) => t,
        (todo) =>
          Row({
            get todo() {
              return todo();
            },
          }),
      );
      return ul;
    }, host);
    const a = rowOf(host, "a");
    items.set(todos("a"));
    expect(rowOf(host, "a")).not.toBe(a);
    dispose();
  });

  it("For (hand-built, plain values) re-renders a row for a new item object", () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    const items = rootSignal<Todo[]>(todos("a"));
    const dispose = mount(() => {
      const ul = clone(UL);
      ul.appendChild(
        For({
          get each() {
            return items.get();
          },
          key: "id",
          children: (todo) => Row({ todo }),
        }),
      );
      return ul;
    }, host);
    expect(titles(host)).toEqual(["a0"]);
    items.set([{ id: "a", title: "a1" }]);
    expect(titles(host)).toEqual(["a1"]);
    dispose();
  });
});
