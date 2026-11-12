// @vitest-environment happy-dom
// A control in a keyed `For` row that is kept across a change of `each` shows the new prop values: every prop a
// control renders is bound when it is a getter (the way the compiler passes props). Seed 1337.
import { scope, signal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import type { Href } from "@keel/router";
import { mount } from "@keel/runtime-dom";
import { clone, list, template } from "@keel/runtime-dom/ops";
import { Box, Button, Checkbox, Image, Input, Link, Select, Text, TextArea } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
type Todo = { readonly id: string; readonly title: string; readonly done: boolean; readonly n: number };
const isHref = (x: string): x is Href => x.startsWith("https://");
const href = (x: string): Href => {
  if (!isHref(x)) throw new Error("not an href");
  return x;
};
const UL = template("<ul><!----></ul>");

/** One row of controls; every prop comes through a getter on the row's current item. */
function Row(todo: () => Todo): Node {
  return Box({
    as: "li",
    get id() {
      return `row-${todo().id}`;
    },
    children: () => [
      Checkbox({
        get label() {
          return todo().title;
        },
        get checked() {
          return todo().done;
        },
      }),
      Link({
        get to() {
          return href(`https://x.test/${todo().title}`);
        },
        get lang() {
          return todo().done ? "fr" : "en";
        },
        children: "open",
      }),
      Input({
        label: "Title",
        get value() {
          return todo().title;
        },
        get name() {
          return `title-${todo().n}`;
        },
      }),
      TextArea({
        label: "Note",
        get value() {
          return `note ${todo().n}`;
        },
        get rows() {
          return todo().n + 1;
        },
      }),
      Select({
        label: "Pick",
        get options() {
          return [{ value: "a", label: `A${todo().n}` }];
        },
      }),
      Image({
        get alt() {
          return todo().title;
        },
        get src() {
          return `https://x.test/${todo().n}.png`;
        },
      }),
      Button({
        get disabled() {
          return todo().done;
        },
        get type() {
          return todo().done ? "submit" : "button";
        },
        children: "go",
      }),
      Text({
        get id() {
          return `text-${todo().n}`;
        },
        children: "t",
      }),
    ],
  });
}

const rootSignal = <T>(initial: T): Signal<T> => {
  const box: { s: Signal<T> | null } = { s: null };
  scope(() => {
    box.s = signal(initial);
  });
  if (box.s === null) throw new Error("no signal");
  return box.s;
};

const setup = (initial: Todo[]): { items: Signal<Todo[]>; host: HTMLElement; dispose: () => void } => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const items = rootSignal(initial);
  const dispose = mount(() => {
    const ul = clone(UL);
    const anchor = ul.lastChild;
    if (anchor === null) throw new Error("no anchor");
    list(
      anchor,
      () => items.get(),
      (t) => t.id,
      (todo) => Row(todo),
    );
    return ul;
  }, host);
  return { items, host, dispose };
};

const q = <E extends Element>(host: Element, sel: string, kind: new () => E): E => {
  const e = host.querySelector(sel);
  if (!(e instanceof kind)) throw new Error(`no ${sel}`);
  return e;
};

/** What the row shows, read from the DOM. */
const shown = (host: Element) => {
  const box = q(host, "li", HTMLLIElement);
  const check = q(box, "input[type=checkbox]", HTMLInputElement);
  const input = q(box, "input:not([type=checkbox])", HTMLInputElement);
  const select = q(box, "select", HTMLSelectElement);
  return {
    box,
    check,
    id: box.id,
    checked: check.checked,
    label: box.querySelector(`label[for="${check.id}"]`)?.textContent,
    to: q(box, "a", HTMLAnchorElement).getAttribute("href"),
    lang: q(box, "a", HTMLAnchorElement).getAttribute("lang"),
    value: input.value,
    name: input.getAttribute("name"),
    note: q(box, "textarea", HTMLTextAreaElement).value,
    rows: q(box, "textarea", HTMLTextAreaElement).getAttribute("rows"),
    option: select.options[0]?.textContent,
    alt: q(box, "img", HTMLImageElement).getAttribute("alt"),
    src: q(box, "img", HTMLImageElement).getAttribute("src"),
    disabled: q(box, "button", HTMLButtonElement).hasAttribute("disabled"),
    type: q(box, "button", HTMLButtonElement).getAttribute("type"),
    textId: q(box, "span", HTMLSpanElement).id,
  };
};

const expected = (t: Todo) => ({
  id: `row-${t.id}`,
  checked: t.done,
  label: t.title,
  to: `https://x.test/${t.title}`,
  lang: t.done ? "fr" : "en",
  value: t.title,
  name: `title-${t.n}`,
  note: `note ${t.n}`,
  rows: String(t.n + 1),
  option: `A${t.n}`,
  alt: t.title,
  src: `https://x.test/${t.n}.png`,
  disabled: t.done,
  type: t.done ? "submit" : "button",
  textId: `text-${t.n}`,
});

describe("a control in a kept row", () => {
  it("shows the new prop values on the same element, and the checkbox keeps focus", () => {
    const { items, host, dispose } = setup([{ id: "a", title: "one", done: false, n: 0 }]);
    const before = shown(host);
    before.check.focus();
    items.set([{ id: "a", title: "two", done: true, n: 1 }]);
    const after = shown(host);
    expect(after.box).toBe(before.box);
    expect(after.check).toBe(before.check);
    expect(document.activeElement).toBe(before.check);
    const { box: _b, check: _c, ...rest } = after;
    expect(rest).toEqual(expected({ id: "a", title: "two", done: true, n: 1 }));
    dispose();
    host.remove();
  });

  it("property: over any sequence of items with the same key, the row shows the last one", () => {
    const todo = fc.record({
      title: fc.constantFrom("one", "two", "three"),
      done: fc.boolean(),
      n: fc.nat(5),
    });
    fc.assert(
      fc.property(fc.array(todo, { minLength: 1, maxLength: 6 }), (seq) => {
        const [head, ...tail] = seq.map((t) => ({ id: "k", ...t }));
        if (head === undefined) return;
        const { items, host, dispose } = setup([head]);
        const el = shown(host).box;
        for (const t of tail) {
          items.set([t]);
          const { box, check: _c, ...rest } = shown(host);
          expect(box).toBe(el);
          expect(rest).toEqual(expected(t));
        }
        dispose();
        host.remove();
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});

describe("Select options rebuilt", () => {
  const opts = (xs: readonly string[]) => xs.map((v) => ({ value: v, label: v.toUpperCase() }));
  /** The select built in an untracked scope inside a mount, so its getters are read by its own bindings only. */
  const inRow = (make: () => Node): { host: HTMLElement; dispose: () => void } => {
    const host = document.createElement("div");
    const dispose = mount(() => {
      const box: { node?: Node } = {};
      scope(() => {}).run(() => {
        box.node = make();
      });
      if (box.node === undefined) throw new Error("no node");
      return box.node;
    }, host);
    return { host, dispose };
  };
  const settle = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
  };
  it("applies the bound value once its option exists", async () => {
    const value = rootSignal("b");
    const options = rootSignal(opts(["a", "b"]));
    const { host, dispose } = inRow(() =>
      Select({
        label: "K",
        get value() {
          return value.get();
        },
        get options() {
          return options.get();
        },
      }),
    );
    value.set("c");
    await settle();
    options.set(opts(["a", "b", "c"]));
    await settle();
    expect(host.querySelector("select")?.value).toBe("c");
    dispose();
  });
  it("keeps the user's choice across a rebuild when value is not bound", async () => {
    const options = rootSignal(opts(["a", "b"]));
    const { host, dispose } = inRow(() =>
      Select({
        label: "K",
        get options() {
          return options.get();
        },
      }),
    );
    const el = host.querySelector("select");
    if (el === null) throw new Error("no select");
    el.value = "b";
    options.set(opts(["a", "b", "c"]));
    await settle();
    expect(el.value).toBe("b");
    dispose();
  });
});
