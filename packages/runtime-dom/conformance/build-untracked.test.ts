// @vitest-environment happy-dom
// Cites k.component Conformance clause 14 (a component reading a signal at its top level keeps its nodes, focus and local signals; a binding updates): this file holds the `.ts` call form; the JSX and route page forms are in packages/testing/conformance/build-untracked.test.ts, which quotes the clause (runtime-dom may import neither the compiler nor the router).
// Seed: 1337.
// ASSUMPTION: the hand-built component uses the ops a compiled one lowers to (`template`, `clone`, `text`), as for-keyed-rows-0090 does.
import { createCtx } from "@keel/ctx";
import { scope, signal as newSignal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { clone, template, text } from "@keel/runtime-dom/ops";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, flush } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

/** Signals are created in a scope (k.reactive E1203). */
const owner = scope(() => undefined, { detached: true });
const signal = <T>(v: T): Signal<T> => owner.run(() => newSignal(v));

type Env = { sig: Signal<number>; builds: number; seen: number[]; local: Signal<number> | undefined };

const ReaderT = template('<div><label>Name<input class="f"></label><p class="live"></p><p class="loc"></p></div>');
const need = (root: Node, sel: string): Element => {
  const found = root instanceof Element ? root.querySelector(sel) : null;
  if (found === null) throw new Error(`fixture: template lacks ${sel}`);
  return found;
};

/** A component reading `env.sig` at its top level (a read at build) and again in a binding. */
const Reader = (env: Env): Node => {
  env.builds++;
  env.seen.push(env.sig.get());
  const local = signal(0);
  env.local = local;
  const root = clone(ReaderT);
  text(need(root, ".live"), () => String(env.sig.get()));
  text(need(root, ".loc"), () => String(local.get()));
  return root;
};

const ParentT = template("<section><!----></section>");
/** A `.ts` parent that calls `Reader` as a plain function. */
const Parent = (env: Env): Node => {
  const root = clone(ParentT);
  const anchor = root.firstChild;
  if (anchor === null) throw new Error("fixture: template lacks anchor");
  root.insertBefore(Reader(env), anchor);
  return root;
};

const forms: readonly [string, (env: Env) => Node][] = [
  ["mount of the component", (env) => Reader(env)],
  ["a call from a .ts parent", (env) => Parent(env)],
];

const open = (build: (env: Env) => Node) => {
  const env: Env = { sig: signal(0), builds: 0, seen: [], local: undefined };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const dispose = mount(() => build(env), host, { ctx: simCtx });
  const q = (sel: string): Element => need(host, sel);
  return {
    env,
    q,
    teardown: () => {
      dispose();
      host.remove();
    },
  };
};

describe("k.component: a component is built untracked, a binding is what updates (.ts call)", () => {
  for (const [name, build] of forms) {
    it(`A component reading a signal at its top level, from ${name}, keeps its nodes, focus and local signals when the signal changes`, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 5 }),
          fc.integer({ min: 1, max: 1000 }),
          async (values, mark) => {
            const m = open(build);
            const input = m.q(".f");
            const live = m.q(".live");
            const loc = m.q(".loc");
            const local = m.env.local;
            if (local === undefined) throw new Error("fixture: component did not run");
            if (!(input instanceof HTMLElement)) throw new Error("fixture: input is not an element");
            input.focus();
            local.set(mark);
            await flush();
            for (const v of values) {
              m.env.sig.set(v);
              await flush();
            }
            expect(m.env.builds).toBe(1);
            expect(m.env.seen).toEqual([0]);
            expect(m.q(".f")).toBe(input);
            expect(m.q(".live")).toBe(live);
            expect(m.q(".loc")).toBe(loc);
            expect(document.activeElement).toBe(input);
            expect(m.env.local).toBe(local);
            expect(local.get()).toBe(mark);
            expect(loc.textContent).toBe(String(mark));
            m.teardown();
          },
        ),
        { seed: SEED, numRuns: 20 },
      );
    });

    it(`A binding reading the signal updates, in ${name}`, async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), async (v) => {
          const m = open(build);
          expect(m.q(".live").textContent).toBe("0");
          m.env.sig.set(v);
          await flush();
          expect(m.q(".live").textContent).toBe(String(v));
          m.teardown();
        }),
        { seed: SEED, numRuns: 20 },
      );
    });
  }
});
