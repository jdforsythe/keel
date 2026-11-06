// @vitest-environment happy-dom
// Property seed: 1337. Structural ops own rows/branches through `home.run` (rfc:0014, runtime PLAN D27).
import { inspect } from "@keel/reactive";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { mount } from "../src/index.ts";
import { clone, cond, list, template, text } from "../src/ops/index.ts";
import { SEED, rootSignal } from "./support.ts";

const UL = template("<ul><!----></ul>");
const LI = template("<li></li>");
const P = template("<p></p>");

const anchorOf = (el: Element): Node => {
  const a = el.lastChild;
  if (a === null) throw new Error("no anchor");
  return a;
};

describe("home scope: no per-commit nodes", () => {
  it("over random add/remove commits, the live reactive node count depends only on the rows shown", () => {
    fc.assert(
      fc.property(
        fc.array(fc.uniqueArray(fc.integer({ min: 0, max: 5 }), { maxLength: 6 }), { maxLength: 20 }),
        (steps) => {
          const base = inspect().nodes.length;
          const items = rootSignal<{ id: number }[]>([]);
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
            );
            return ul;
          }, document.createElement("div"));
          const empty = inspect().nodes.length;
          const perRow = (ks: readonly number[]): number => {
            items.set(ks.map((id) => ({ id })));
            return inspect().nodes.length;
          };
          perRow([0]);
          const oneRow = inspect().nodes.length - empty;
          items.set([]);
          for (const ks of steps) expect(perRow(ks)).toBe(empty + ks.length * oneRow);
          dispose();
          // The root signal (and its scope) remain.
          expect(inspect().nodes.length).toBe(base + 2);
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });
});

describe("home scope: units outlive their op's effect reruns", () => {
  it("the list's empty slot keeps its bindings when the reconcile effect reruns while still empty", () => {
    const items = rootSignal<{ id: number }[]>([]);
    const label = rootSignal("none");
    const host = document.createElement("div");
    const dispose = mount(() => {
      const ul = clone(UL);
      list(
        anchorOf(ul),
        () => items.get(),
        (i) => i.id,
        () => clone(LI),
        () => {
          const p = clone(P);
          text(p, () => label.get());
          return p;
        },
      );
      return ul;
    }, host);
    items.set([]);
    label.set("still none");
    expect(host.querySelector("p")?.textContent).toBe("still none");
    dispose();
  });

  it("a cond branch is disposed (bindings stop) when it is replaced", () => {
    const on = rootSignal(true);
    const label = rootSignal("a");
    let reads = 0;
    const host = document.createElement("div");
    const dispose = mount(() => {
      const ul = clone(UL);
      cond(
        anchorOf(ul),
        () => on.get(),
        () => {
          const p = clone(P);
          text(p, () => {
            reads++;
            return label.get();
          });
          return p;
        },
      );
      return ul;
    }, host);
    expect(reads).toBe(1);
    on.set(false);
    label.set("b");
    expect(reads).toBe(1);
    expect(host.querySelector("p")).toBeNull();
    dispose();
  });
});
