import { effect } from "@keel/reactive";
// @vitest-environment happy-dom
// Property seed: 1337. Structural ops: keyed list moves rows, cond/match swap branches in their own scope.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Case, For, If, Match, mount } from "../src/index.ts";
import { clone, cond, list, match, template, text } from "../src/ops/index.ts";
import { SEED, rootSignal } from "./support.ts";

const UL = template("<ul><!----></ul>");
const LI = template("<li></li>");

const anchorOf = (el: Element): Node => {
  const a = el.lastChild;
  if (a === null) throw new Error("no anchor");
  return a;
};

describe("list: keyed rows", () => {
  it("over random key sequences, rows follow order, keep identity while their key stays, and track item/index", () => {
    const keys = fc.uniqueArray(fc.integer({ min: 0, max: 9 }), { maxLength: 8 });
    fc.assert(
      fc.property(fc.array(fc.tuple(keys, fc.nat(3)), { minLength: 1, maxLength: 8 }), (steps) => {
        const items = rootSignal<{ id: number; v: number }[]>([]);
        const host = document.createElement("div");
        let rowRenders = 0;
        const dispose = mount(() => {
          const ul = clone(UL);
          list(
            anchorOf(ul),
            () => items.get(),
            (i) => i.id,
            (item, index) => {
              rowRenders++;
              const li = clone(LI);
              text(li, () => `${item().id}:${item().v}@${index()}`);
              return li;
            },
          );
          return ul;
        }, host);
        let prev = new Map<number, Element>();
        for (const [ks, v] of steps) {
          const before = rowRenders;
          items.set(ks.map((id) => ({ id, v })));
          const lis = [...host.querySelectorAll("li")];
          expect(lis.map((li) => li.textContent)).toEqual(ks.map((id, i) => `${id}:${v}@${i}`));
          const next = new Map<number, Element>();
          ks.forEach((k, i) => {
            const li = lis[i];
            if (li === undefined) throw new Error("missing row");
            if (prev.has(k)) expect(li).toBe(prev.get(k));
            next.set(k, li);
          });
          expect(rowRenders - before).toBe(ks.filter((k) => !prev.has(k)).length);
          prev = next;
        }
        dispose();
        expect(host.querySelectorAll("li").length).toBe(0);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("a removed row's effects never run again", () => {
    const one = { id: 1 };
    const two = { id: 2 };
    const items = rootSignal<{ id: number }[]>([one, two]);
    const tick = rootSignal(0);
    const runs = new Map<number, number>();
    const host = document.createElement("div");
    const dispose = mount(() => {
      const ul = clone(UL);
      list(
        anchorOf(ul),
        () => items.get(),
        (i) => i.id,
        (item) => {
          const id = item().id;
          effect(() => {
            tick.get();
            runs.set(id, (runs.get(id) ?? 0) + 1);
          });
          return clone(LI);
        },
      );
      return ul;
    }, host);
    items.set([two]);
    const r1 = runs.get(1);
    tick.set(1);
    expect(runs.get(1)).toBe(r1);
    expect(runs.get(2)).toBe(2);
    dispose();
  });

  it("For (hand-built) renders keyed rows with plain values; a move keeps the row", () => {
    const a0 = { id: "a" };
    const b0 = { id: "b" };
    const items = rootSignal([a0, b0]);
    const host = document.createElement("div");
    const dispose = mount(() => {
      const ul = clone(UL);
      ul.appendChild(
        For({
          get each() {
            return items.get();
          },
          key: "id",
          children: (item, index) => {
            const li = clone(LI);
            text(li, () => `${item.id}${index}`);
            return li;
          },
        }),
      );
      return ul;
    }, host);
    const a = host.querySelector("li");
    expect(a?.textContent).toBe("a0");
    items.set([b0, a0]);
    expect([...host.querySelectorAll("li")].map((l) => l.textContent?.[0])).toEqual(["b", "a"]);
    expect(host.querySelectorAll("li")[1]).toBe(a);
    items.set([b0, { id: "a" }]);
    expect(host.querySelectorAll("li")[1]).not.toBe(a);
    expect(host.querySelectorAll("li")[1]?.textContent).toBe("a1");
    dispose();
  });
});

describe("cond and match", () => {
  it("cond shows exactly the branch for the latest truthiness; a branch re-renders only when it flips", () => {
    const T = template('<div id="d"><!----></div>');
    const A = template('<i id="a">a</i>');
    const B = template('<b id="b">b</b>');
    fc.assert(
      fc.property(fc.array(fc.oneof(fc.boolean(), fc.integer({ min: 0, max: 2 })), { maxLength: 10 }), (seq) => {
        const s = rootSignal<unknown>(true);
        let renders = 0;
        const host = document.createElement("div");
        const dispose = mount(() => {
          const d = clone(T);
          cond(
            anchorOf(d),
            () => s.get(),
            () => {
              renders++;
              return clone(A);
            },
            () => {
              renders++;
              return clone(B);
            },
          );
          return d;
        }, host);
        let prev = true;
        for (const v of seq) {
          const before = renders;
          s.set(v);
          const now = Boolean(v);
          expect(host.querySelector("#a") !== null).toBe(now);
          expect(host.querySelector("#b") !== null).toBe(!now);
          expect(renders - before).toBe(now === prev ? 0 : 1);
          prev = now;
        }
        dispose();
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("match renders the case for the current tag and tracks the value within a case", () => {
    type Shape = { kind: "circle"; r: number } | { kind: "square"; side: number };
    const shapes = fc.oneof(
      fc.nat(9).map((r): Shape => ({ kind: "circle", r })),
      fc.nat(9).map((side): Shape => ({ kind: "square", side })),
    );
    const T = template('<div id="d"><!----></div>');
    const P = template("<p></p>");
    fc.assert(
      fc.property(fc.array(shapes, { minLength: 1, maxLength: 8 }), (seq) => {
        const s = rootSignal<Shape>({ kind: "circle", r: 0 });
        const host = document.createElement("div");
        const dispose = mount(() => {
          const d = clone(T);
          match(anchorOf(d), () => s.get(), "kind", {
            circle: (v) => {
              const p = clone(P);
              text(p, () => {
                const x = v();
                return x.kind === "circle" ? `c${x.r}` : "";
              });
              return p;
            },
            square: (v) => {
              const p = clone(P);
              text(p, () => {
                const x = v();
                return x.kind === "square" ? `s${x.side}` : "";
              });
              return p;
            },
          });
          return d;
        }, host);
        for (const v of seq) {
          s.set(v);
          expect(host.querySelector("p")?.textContent).toBe(v.kind === "circle" ? `c${v.r}` : `s${v.side}`);
          expect(host.querySelectorAll("p").length).toBe(1);
        }
        dispose();
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  it("If and Match/Case (hand-built) work without the compiler", () => {
    const on = rootSignal(false);
    const tag = rootSignal<{ tag: "x" | "y" }>({ tag: "x" });
    const host = document.createElement("div");
    const D = template('<div id="d"></div>');
    const dispose = mount(() => {
      const d = clone(D);
      d.appendChild(
        If({
          get when() {
            return on.get();
          },
          children: () => clone(template('<i id="yes">y</i>')),
          fallback: () => clone(template('<i id="no">n</i>')),
        }),
      );
      d.appendChild(
        Match({
          get on() {
            return tag.get();
          },
          children: [
            Case<{ tag: "x" | "y" }>({ tag: "x", children: () => clone(template('<u id="x">x</u>')) }),
            Case<{ tag: "x" | "y" }>({ tag: "y", children: () => clone(template('<u id="y">y</u>')) }),
          ],
        }),
      );
      return d;
    }, host);
    expect(host.querySelector("#no")).not.toBeNull();
    expect(host.querySelector("#x")).not.toBeNull();
    on.set(true);
    tag.set({ tag: "y" });
    expect(host.querySelector("#yes")).not.toBeNull();
    expect(host.querySelector("#no")).toBeNull();
    expect(host.querySelector("#y")).not.toBeNull();
    expect(host.querySelector("#x")).toBeNull();
    dispose();
  });
});

describe("list: empty slot (runtime D28)", () => {
  it("renders while the list is empty and is removed when rows arrive, and back", () => {
    const items = rootSignal<{ id: number }[]>([]);
    const host = document.createElement("div");
    const dispose = mount(() => {
      const ul = clone(UL);
      list(
        anchorOf(ul),
        () => items.get(),
        (i) => i.id,
        (item) => {
          const li = clone(LI);
          text(li, () => String(item().id));
          return li;
        },
        () => {
          const p = document.createElement("p");
          p.textContent = "none";
          return p;
        },
      );
      return ul;
    }, host);
    expect(host.querySelectorAll("p").length).toBe(1);
    items.set([{ id: 1 }]);
    expect(host.querySelectorAll("p").length).toBe(0);
    expect(host.querySelectorAll("li").length).toBe(1);
    items.set([]);
    expect(host.querySelectorAll("p").length).toBe(1);
    expect(host.querySelectorAll("li").length).toBe(0);
    dispose();
    expect(host.querySelectorAll("p").length).toBe(0);
  });
});
