// @vitest-environment happy-dom
// A unit's nodes include what a structural op at its top level renders before its anchor after the unit
// was recorded (a route's `errorElement` Boundary is one): they leave and move with the unit.
import { describe, expect, it } from "vitest";
import { mount } from "../src/index.ts";
import { boundary, clone, cond, list, template, text } from "../src/ops/index.ts";
import { rootSignal } from "./support.ts";
import { testCtx } from "./testCtx.ts";

const PAGE = template("<main>page</main>");
const OTHER = template("<main>other</main>");
const LI = template("<li></li>");

/** A fragment whose only top-level node is the anchor of a structural op that `op` sets up. */
const topLevel = (op: (anchor: Node) => void): Node => {
  const f = document.createDocumentFragment();
  const a = document.createComment("");
  f.append(a);
  op(a);
  return f;
};

const mountSwitch = (page: () => Node): { show: (v: boolean) => void; host: HTMLElement; dispose: () => void } => {
  const on = rootSignal(true);
  const host = document.createElement("div");
  const dispose = mount(
    () =>
      topLevel((a) =>
        cond(
          a,
          () => on.get(),
          page,
          () => clone(OTHER),
        ),
      ),
    host,
    { ctx: testCtx },
  );
  return { show: (v) => on.set(v), host, dispose };
};

describe("unit nodes: a structural op at the top level of a unit", () => {
  it("a Boundary's children leave when the unit is replaced", () => {
    const s = mountSwitch(() =>
      topLevel((a) =>
        boundary(
          a,
          () => clone(PAGE),
          () => document.createTextNode("err"),
        ),
      ),
    );
    expect(s.host.querySelectorAll("main")).toHaveLength(1);
    s.show(false);
    expect([...s.host.querySelectorAll("main")].map((m) => m.textContent)).toEqual(["other"]);
    s.show(true);
    expect([...s.host.querySelectorAll("main")].map((m) => m.textContent)).toEqual(["page"]);
    s.dispose();
    expect(s.host.childNodes).toHaveLength(0);
  });

  it("a Boundary's fallback, after it caught a throw, leaves when the unit is replaced", () => {
    const s = mountSwitch(() =>
      topLevel((a) =>
        boundary(
          a,
          () => {
            throw new Error("boom");
          },
          () => {
            const p = document.createElement("p");
            p.textContent = "caught";
            return p;
          },
        ),
      ),
    );
    expect(s.host.textContent).toBe("caught");
    s.show(false);
    expect(s.host.textContent).toBe("other");
  });

  it("nested ops at the top level, two deep, leave with the unit", () => {
    const s = mountSwitch(() =>
      topLevel((a) =>
        cond(
          a,
          () => true,
          () =>
            topLevel((b) =>
              boundary(
                b,
                () => clone(PAGE),
                () => document.createTextNode("err"),
              ),
            ),
        ),
      ),
    );
    expect(s.host.textContent).toBe("page");
    s.show(false);
    expect(s.host.textContent).toBe("other");
  });

  it("a list row whose top level is an op moves and leaves with its row", () => {
    const items = rootSignal([1, 2, 3]);
    const host = document.createElement("ul");
    mount(
      () =>
        topLevel((a) =>
          list(
            a,
            () => items.get(),
            (i) => i,
            (item) =>
              topLevel((b) =>
                cond(
                  b,
                  () => true,
                  () => {
                    const li = clone(LI);
                    text(li, () => String(item()));
                    return li;
                  },
                ),
              ),
          ),
        ),
      host,
      { ctx: testCtx },
    );
    const shown = (): string[] => [...host.querySelectorAll("li")].map((li) => li.textContent ?? "");
    expect(shown()).toEqual(["1", "2", "3"]);
    items.set([3, 1, 2]);
    expect(shown()).toEqual(["3", "1", "2"]);
    items.set([2]);
    expect(shown()).toEqual(["2"]);
  });
});
