// Spec: k.component, clause "A component reading a signal at its top level, rendered from JSX, from a `.ts` call and as a route page, keeps its nodes, focus and local signals when the signal changes; a binding reading it updates."
// Seed: 1337.
// @vitest-environment happy-dom
// This file holds the JSX and route page forms (they need the compiler and the router, which runtime-dom may not import);
// the `.ts` call form is in packages/runtime-dom/conformance/build-untracked.test.ts, which cites the clause.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import { signal as newSignal, scope } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import { createRouter, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { text } from "@keel/runtime-dom/ops";
import * as ui from "@keel/ui";
import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";

const SEED = 1337;
const simCtx = () => createCtx({ mode: "sim", seed: SEED });

// A failed property leaves its host mounted: start each test from an empty document.
afterEach(() => document.body.replaceChildren());

/** Signals are created in a scope (k.reactive E1203). */
const owner = scope(() => undefined, { detached: true });
const signal = <T>(v: T): Signal<T> => owner.run(() => newSignal(v));

const hops = async (n = 50): Promise<void> => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

type Env = { sig: Signal<number>; builds: number; seen: number[]; local: Signal<number> | undefined };
const newEnv = (): Env => ({ sig: signal(0), builds: 0, seen: [], local: undefined });

/** The probe a fixture reads through: `fx.top()` is called at the top level of the build, `fx.makeLocal()` makes the component's local signal. */
const fxOf = (env: Env) => ({
  sig: env.sig,
  top: (v: number): void => {
    env.builds++;
    env.seen.push(v);
  },
  makeLocal: (): Signal<number> => {
    const local = signal(0);
    env.local = local;
    return local;
  },
});

const JSX_SOURCE = `import { Box, Input, Text } from "@keel/ui"
import * as fx from "fx"

export default function Reader() {
  fx.top(fx.sig.get())
  const local = fx.makeLocal()
  return <Box id="page"><Input id="field" label="Name" /><Text id="live">{String(fx.sig.get())}</Text><Text id="loc">{String(local.get())}</Text></Box>
}
`;

/** Compiles the JSX component (zero diagnostics) and mounts it. */
const openJsx = (env: Env) => {
  const r = compile([{ path: "Reader.tsx", source: JSX_SOURCE }]);
  expect(r.diagnostics).toEqual([]);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code, { "@keel/ui": ui, fx: fxOf(env) });
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  const host = document.createElement("div");
  document.body.appendChild(host);
  const ctx = simCtx();
  const dispose = mount(
    () => {
      const node: unknown = fn({}, ctx);
      if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
      return node;
    },
    host,
    { ctx },
  );
  return {
    teardown: () => {
      dispose();
      host.remove();
    },
  };
};

/** A route page reading the signal at its top level and in a binding. */
const openRoute = async (env: Env) => {
  const page = (): Node => {
    env.builds++;
    env.seen.push(env.sig.get());
    const local = signal(0);
    env.local = local;
    const main = document.createElement("main");
    main.id = "page";
    const field = ui.Input({ id: "field", label: "Name" });
    const live = document.createElement("p");
    live.id = "live";
    text(live, () => String(env.sig.get()));
    const loc = document.createElement("p");
    loc.id = "loc";
    text(loc, () => String(local.get()));
    main.append(field, live, loc);
    return main;
  };
  const readContract = contract("read", {
    "read.page": { path: "/read" },
  });

  const routes = manifest(readContract, {
    "read.page": { component: page },
  });
  const entries: string[] = ["/read"];
  const router = createRouter(routes, {
    ctx: createCtx({ mode: "sim", seed: SEED }),
    history: {
      push: (url) => {
        entries.push(url);
      },
      replace: (url) => {
        entries[entries.length - 1] = url;
      },
      current: () => entries[entries.length - 1] ?? "/read",
      onPop: () => undefined,
    },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host, { ctx: simCtx() });
  await hops();
  return {
    teardown: () => {
      unmount();
      router.dispose();
      host.remove();
    },
  };
};

const byId = (id: string): Element => {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`fixture: no element ${id}`);
  return found;
};
const inputIn = (id: string): HTMLElement => {
  const found = byId(id).querySelector("input") ?? byId(id);
  if (!(found instanceof HTMLElement)) throw new Error("fixture: no focusable control");
  return found;
};

const forms: readonly [string, (env: Env) => Promise<{ teardown: () => void }>][] = [
  ["rendered from JSX", async (env) => openJsx(env)],
  ["as a route page", openRoute],
];

describe("k.component: a component is built untracked, a binding is what updates (JSX and route page)", () => {
  for (const [name, open] of forms) {
    it(`A component reading a signal at its top level, ${name}, keeps its nodes, focus and local signals when the signal changes`, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 5 }),
          fc.integer({ min: 1, max: 1000 }),
          async (values, mark) => {
            const env = newEnv();
            const h = await open(env);
            const page = byId("page");
            const live = byId("live");
            const loc = byId("loc");
            const input = inputIn("field");
            const local = env.local;
            if (local === undefined) throw new Error("fixture: component did not run");
            input.focus();
            local.set(mark);
            await hops();
            for (const v of values) {
              env.sig.set(v);
              await hops();
            }
            expect(env.builds).toBe(1);
            expect(env.seen).toEqual([0]);
            expect(byId("page")).toBe(page);
            expect(byId("live")).toBe(live);
            expect(byId("loc")).toBe(loc);
            expect(inputIn("field")).toBe(input);
            expect(document.activeElement).toBe(input);
            expect(env.local).toBe(local);
            expect(local.get()).toBe(mark);
            expect(loc.textContent).toBe(String(mark));
            h.teardown();
          },
        ),
        { seed: SEED, numRuns: 10 },
      );
    });

    it(`A binding reading the signal updates, ${name}`, async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), async (v) => {
          const env = newEnv();
          const h = await open(env);
          expect(byId("live").textContent).toBe("0");
          env.sig.set(v);
          await hops();
          expect(byId("live").textContent).toBe(String(v));
          h.teardown();
        }),
        { seed: SEED, numRuns: 10 },
      );
    });
  }
});
