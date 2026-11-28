// Spec: k.component, clause "A `Case` reading `value()` at its top level renders once per tag; its binding reading `value()` shows each new value."
// Seed: 1337.
// @vitest-environment happy-dom
// ASSUMPTION: the compiled `Match`/`Case` is the `match` op from `@keel/runtime-dom/ops`: match(anchor, on, "tag", { [tag]: (value) => Node }),
// where `value()` is the union's current value (as for-keyed-rows-0090 assumes for `list`).
import { createCtx } from "@keel/ctx";
import { scope, signal as newSignal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { clone, match, template, text } from "@keel/runtime-dom/ops";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, flush } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

/** Signals are created in a scope (k.reactive E1203). */
const owner = scope(() => undefined, { detached: true });
const signal = <T>(v: T): Signal<T> => owner.run(() => newSignal(v));

type Shape = { tag: "circle"; r: number } | { tag: "square"; side: number };

const HostT = template("<div><!----></div>");
const CaseT = template('<p class="c"><label>Size<input class="f"></label><span class="v"></span></p>');
const need = (root: Node, sel: string): Element => {
  const found = root instanceof Element ? root.querySelector(sel) : null;
  if (found === null) throw new Error(`fixture: template lacks ${sel}`);
  return found;
};
const sizeOf = (s: Shape): number => (s.tag === "circle" ? s.r : s.side);

const open = (initial: Shape) => {
  const on = signal<Shape>(initial);
  const renders = { circle: 0, square: 0 };
  const topReads: number[] = [];
  const caseFor = (tag: "circle" | "square") => (value: () => Shape) => {
    renders[tag]++;
    topReads.push(sizeOf(value())); // a top-level read of value(): the value at build
    const root = clone(CaseT);
    text(need(root, ".v"), () => `${tag}:${sizeOf(value())}`); // a binding reading value()
    return root;
  };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const dispose = mount(
    () => {
      const root = clone(HostT);
      const anchor = root.firstChild;
      if (anchor === null) throw new Error("fixture: template lacks anchor");
      match(anchor, () => on.get(), "tag", { circle: caseFor("circle"), square: caseFor("square") });
      return root;
    },
    host,
    { ctx: simCtx },
  );
  return {
    on,
    renders,
    topReads,
    shown: (): Element => need(host, ".c"),
    teardown: () => {
      dispose();
      host.remove();
    },
  };
};

const size = fc.integer({ min: 1, max: 1000 });

describe("k.component: a Case reads value() once per tag at build; its binding follows", () => {
  it("A `Case` reading `value()` at its top level renders once per tag: a new value under the same tag keeps its element and focus", async () => {
    await fc.assert(
      fc.asyncProperty(size, fc.array(size, { minLength: 1, maxLength: 5 }), async (first, rest) => {
        const m = open({ tag: "circle", r: first });
        const el = m.shown();
        const input = need(el, ".f");
        if (!(input instanceof HTMLElement)) throw new Error("fixture: input is not an element");
        input.focus();
        for (const r of rest) {
          m.on.set({ tag: "circle", r });
          await flush();
        }
        expect(m.renders.circle).toBe(1);
        expect(m.topReads).toEqual([first]);
        expect(m.shown()).toBe(el);
        expect(document.activeElement).toBe(input);
        m.teardown();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("A `Case` renders anew when its tag changes, once per change of tag", async () => {
    await fc.assert(
      fc.asyncProperty(size, size, size, async (a, b, c) => {
        const m = open({ tag: "circle", r: a });
        const first = m.shown();
        m.on.set({ tag: "square", side: b });
        await flush();
        expect(m.renders).toEqual({ circle: 1, square: 1 });
        expect(m.shown()).not.toBe(first);
        m.on.set({ tag: "square", side: c });
        await flush();
        expect(m.renders).toEqual({ circle: 1, square: 1 });
        expect(m.topReads).toEqual([a, b]);
        m.teardown();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("its binding reading `value()` shows each new value", async () => {
    await fc.assert(
      fc.asyncProperty(size, fc.array(size, { minLength: 1, maxLength: 6 }), async (first, rest) => {
        const m = open({ tag: "square", side: first });
        expect(m.shown().querySelector(".v")?.textContent).toBe(`square:${first}`);
        for (const side of rest) {
          m.on.set({ tag: "square", side });
          await flush();
          expect(m.shown().querySelector(".v")?.textContent).toBe(`square:${side}`);
        }
        m.teardown();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
