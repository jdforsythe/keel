// @vitest-environment happy-dom
// list: duplicate keys, the `empty` unit's life, a throwing `each`, use outside a render.
import { describe, expect, it } from "vitest";
import { mount } from "../src/index.ts";
import { clone, list, template, text } from "../src/ops/index.ts";
import { rootSignal } from "./support.ts";
import { testCtx } from "./testCtx.ts";

const UL = template("<ul><!----></ul>");
const LI = template("<li></li>");
const NONE = template('<li class="e">none</li>');
const anchorOf = (el: Element): Node => {
  const a = el.lastChild;
  if (a === null) throw new Error("no anchor");
  return a;
};
type Item = { id: string; v: string };

const view = (items: () => readonly Item[], withEmpty: boolean, renders: { n: number } = { n: 0 }) => {
  const host = document.createElement("div");
  const dispose = mount(
    () => {
      const ul = clone(UL);
      list(
        anchorOf(ul),
        items,
        (i) => i.id,
        (item) => {
          renders.n++;
          const li = clone(LI);
          text(li, () => item().v);
          return li;
        },
        withEmpty ? () => clone(NONE) : undefined,
      );
      return ul;
    },
    host,
    { ctx: testCtx },
  );
  return { host, dispose, texts: () => [...host.querySelectorAll("li")].map((l) => l.textContent) };
};

describe("list: duplicate keys", () => {
  it("the first item with a key renders and the later ones do not replace it", () => {
    const items = rootSignal<Item[]>([
      { id: "a", v: "first" },
      { id: "b", v: "b" },
      { id: "a", v: "second" },
    ]);
    const { texts, dispose } = view(() => items.get(), false);
    expect(texts()).toEqual(["first", "b"]);
    items.set([
      { id: "b", v: "b" },
      { id: "a", v: "x" },
      { id: "a", v: "y" },
    ]);
    expect(texts()).toEqual(["b", "x"]);
    dispose();
  });
});

describe("list: empty", () => {
  it("renders while there are no rows, once, keeps its node across empty updates, and goes when rows arrive", () => {
    const items = rootSignal<Item[]>([]);
    const { host, texts, dispose } = view(() => items.get(), true);
    expect(texts()).toEqual(["none"]);
    const none = host.querySelector(".e");
    items.set([]);
    items.set([]);
    expect(host.querySelectorAll(".e")).toHaveLength(1);
    expect(host.querySelector(".e")).toBe(none);
    items.set([{ id: "a", v: "A" }]);
    expect(texts()).toEqual(["A"]);
    items.set([]);
    expect(texts()).toEqual(["none"]);
    expect(host.querySelector(".e")).not.toBe(none);
    dispose();
  });

  it("an empty list without `empty` renders nothing, and rows still arrive", () => {
    const items = rootSignal<Item[]>([]);
    const { texts, dispose } = view(() => items.get(), false);
    expect(texts()).toEqual([]);
    items.set([{ id: "a", v: "A" }]);
    expect(texts()).toEqual(["A"]);
    dispose();
  });

  it("rows added after rows were removed land in the order of `each`", () => {
    const items = rootSignal<Item[]>([
      { id: "a", v: "A" },
      { id: "b", v: "B" },
      { id: "c", v: "C" },
    ]);
    const renders = { n: 0 };
    const { texts, dispose } = view(() => items.get(), false, renders);
    items.set([
      { id: "c", v: "C" },
      { id: "d", v: "D" },
      { id: "a", v: "A" },
    ]);
    expect(texts()).toEqual(["C", "D", "A"]);
    expect(renders.n).toBe(4);
    items.set([]);
    items.set([
      { id: "b", v: "B" },
      { id: "a", v: "A" },
    ]);
    expect(texts()).toEqual(["B", "A"]);
    dispose();
  });
});

describe("list: errors", () => {
  it("a throwing `each` reaches the root Boundary once", () => {
    const bad = rootSignal(false);
    const seen: unknown[] = [];
    const host = document.createElement("div");
    const dispose = mount(
      () => {
        const ul = clone(UL);
        list(
          anchorOf(ul),
          () => {
            if (bad.get()) throw new Error("each failed");
            return ["a"];
          },
          (k) => k,
          () => clone(LI),
        );
        return ul;
      },
      host,
      { ctx: testCtx, onError: (e) => seen.push(e), mode: "dev" },
    );
    expect(host.querySelectorAll("li")).toHaveLength(1);
    bad.set(true);
    expect(seen).toHaveLength(1);
    expect(host.querySelector("[data-k-error]")?.textContent).toBe("each failed");
    dispose();
  });

  it("outside a render, names the op", () => {
    expect(() =>
      list(
        document.createComment(""),
        () => [],
        (k) => k,
        () => clone(LI),
      ),
    ).toThrow("k.runtime: list() called outside a mount or resume render");
  });
});
