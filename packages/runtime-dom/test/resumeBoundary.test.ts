// @vitest-environment happy-dom
// A resumed island's Boundaries: a nested Boundary claims its server region and catches what its children throw; a
// client re-render of any shape (an element, a text node, an empty fragment) is replaced by the root fallback.
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { effect } from "@keel/reactive";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { boundary, clone, on, resume, template } from "../src/ops/index.ts";
import { SEED, rootSignal } from "./support.ts";

const kState = (ids: readonly string[]): string =>
  `<script type="application/json" id="k-state">${JSON.stringify({
    stores: {},
    islands: Object.fromEntries(ids.map((id) => [id, {}])),
  })}</script>`;
const click = (el: Element): void => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
};
const need = (sel: string): Element => {
  const el = document.querySelector(sel);
  if (el === null) throw new Error(`fixture: missing ${sel}`);
  return el;
};
const observed = (): { ctx: ReturnType<typeof createCtx>; errors: () => CtxEvent[] } => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const events: CtxEvent[] = [];
  observe(ctx, (e) => void events.push(e));
  return { ctx, errors: () => events.filter((e) => e.kind === "error") };
};

const B_ROOT = template('<div data-k-island="B"><!----></div>');
const B_BTN = template('<button id="b.boom" data-k="b.boom">x</button>');
const B_FALLBACK = template('<p class="fb">fallback</p>');

describe("a nested Boundary inside a resumed island", () => {
  it("claims its server region, catches its child's throw in place, and reset re-renders the child", () => {
    document.body.innerHTML = `<div data-k-island="B"><!--[--><button id="b.boom" data-k="b.boom">x</button><!--]--><!----></div>${kState(["B"])}`;
    const server = need("#b\\.boom");
    let throws = true;
    let resetIt: () => void = () => {};
    const B = (): Node => {
      const root = clone(B_ROOT);
      const anchor = root.lastChild;
      if (anchor === null) throw new Error("fixture: no anchor");
      boundary(
        anchor,
        () => {
          const b = clone(B_BTN);
          on("b.boom", "click", () => {
            if (throws) throw new Error("child boom");
          });
          return b;
        },
        (error, reset) => {
          resetIt = reset;
          const p = clone(B_FALLBACK);
          p.textContent = error.message;
          return p;
        },
      );
      return root;
    };
    const { ctx, errors } = observed();
    expect(resume(document.body, { B }, { ctx }).warnings).toEqual([]);
    // Claimed, not re-rendered.
    expect(need("#b\\.boom")).toBe(server);
    click(server);
    expect(errors()).toHaveLength(1);
    expect(need("p.fb").textContent).toBe("child boom");
    expect(document.querySelector("#b\\.boom")).toBeNull();
    expect(document.querySelector("pre[data-k-error]")).toBeNull();
    expect(need('[data-k-island="B"]').isConnected).toBe(true);
    throws = false;
    resetIt();
    expect(document.querySelector("p.fb")).toBeNull();
    const again = need("#b\\.boom");
    expect(again).not.toBe(server);
    click(again);
    expect(errors()).toHaveLength(1);
    document.body.innerHTML = "";
  });
});

describe("a client re-render after a mismatch", () => {
  const rerendered = (make: () => Node) => {
    document.body.innerHTML = `<section data-k-island="T"><p>server</p></section>${kState(["T"])}`;
    const bad = rootSignal(false);
    const T = (): Node => {
      effect(() => {
        if (bad.get()) throw new Error("fx T");
      });
      return make();
    };
    const { ctx, errors } = observed();
    expect(resume(document.body, { T }, { ctx, mode: "dev" }).warnings).toHaveLength(1);
    expect(document.querySelector("section")).toBeNull();
    expect(() => bad.set(true)).not.toThrow();
    expect(errors()).toHaveLength(1);
    expect(need('pre[data-k-error=""]').textContent).toBe("fx T");
    expect(need('pre[data-k-error=""]').isConnected).toBe(true);
  };

  it("that returns a text node is replaced by the root fallback when an island effect throws", () => {
    rerendered(() => document.createTextNode("plain"));
    expect(document.body.textContent).not.toContain("plain");
    document.body.innerHTML = "";
  });

  it("that returns an empty fragment shows the root fallback where the island was", () => {
    rerendered(() => document.createDocumentFragment());
    expect(document.body.firstElementChild?.tagName).toBe("PRE");
    document.body.innerHTML = "";
  });

  it("property: whatever it returns, the root fallback takes the island's place between its neighbours (seed 1337)", () => {
    const shapeArb = fc.oneof(
      fc.constant({ kind: "element" as const, n: 1 }),
      fc.constant({ kind: "text" as const, n: 1 }),
      fc.record({ kind: fc.constant("fragment" as const), n: fc.nat({ max: 3 }) }),
    );
    fc.assert(
      fc.property(shapeArb, ({ kind, n }) => {
        document.body.innerHTML = `<i id="before"></i><section data-k-island="T"><p>server</p></section><i id="after"></i>${kState(["T"])}`;
        const bad = rootSignal(false);
        const T = (): Node => {
          effect(() => {
            if (bad.get()) throw new Error("fx T");
          });
          if (kind === "element") return document.createElement("article");
          if (kind === "text") return document.createTextNode("plain");
          const f = document.createDocumentFragment();
          for (let i = 0; i < n; i++) f.append(document.createElement("article"));
          return f;
        };
        const { ctx, errors } = observed();
        expect(resume(document.body, { T }, { ctx, mode: "dev" }).warnings).toHaveLength(1);
        bad.set(true);
        expect(errors()).toHaveLength(1);
        const pre = need('pre[data-k-error=""]');
        expect(pre.previousSibling).toBe(need("#before"));
        expect(pre.nextSibling).toBe(need("#after"));
        expect(document.querySelectorAll("article, pre")).toHaveLength(1);
        expect(document.body.textContent).not.toContain("plain");
        document.body.innerHTML = "";
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});
