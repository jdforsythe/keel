// @vitest-environment happy-dom
// Property seed: 1337. k.host-element Lifecycle, Parse, Harness and replay; k.host-code Code and Events, through the
// `host` op on an `element` div (the `Host` element of `@keel/ui` is this pair).
import { createCtx, observe } from "@keel/ctx";
import type { CtxEvent } from "@keel/ctx";
import type { Signal } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Boundary, If, mount } from "../src/index.ts";
import { harnessed, hosts, serverMode } from "../src/internal/index.ts";
import { element, host } from "../src/ops/index.ts";
import type { HostStart } from "../src/ops/index.ts";
import { SEED, rootSignal } from "./support.ts";

const opts = () => ({ ctx: createCtx({ mode: "sim", seed: SEED }) });

const Points = s.object({ points: s.array(s.number()) });
type P = { readonly points: readonly number[] };
const Pick = s.object({ at: s.number() });

let queue = new Map<number, () => void>();
const frames = () => {
  let next = 1;
  queue = new Map();
  vi.stubGlobal("requestAnimationFrame", (cb: () => void): number => {
    queue.set(next, cb);
    return next++;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number): void => void queue.delete(id));
  return (): void => {
    const now = [...queue.values()];
    queue.clear();
    for (const cb of now) cb();
  };
};
const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const roots: HTMLElement[] = [];
const root = (): HTMLElement => {
  const r = document.createElement("div");
  document.body.appendChild(r);
  roots.push(r);
  return r;
};
afterEach(() => {
  for (const r of roots.splice(0)) r.remove();
  vi.unstubAllGlobals();
});

const probe = () => {
  const log: { mounts: P[]; updates: [P, P][]; disposes: number; emits: ((e: unknown) => void)[] } = {
    mounts: [],
    updates: [],
    disposes: 0,
    emits: [],
  };
  const code: HostStart<P, { at: number }> = {
    start(_node, value, out) {
      log.mounts.push(value);
      log.emits.push((e) => Reflect.apply(out.emit, out, [e]));
      return {
        update: (v, prev) => void log.updates.push([v, prev]),
        dispose: () => {
          log.disposes += 1;
        },
      };
    },
  };
  return { log, code };
};
const chart = (
  code: HostStart<P, { at: number }>,
  value: P | Signal<P>,
  more: { onEvent?: (e: { at: number }) => void } = {},
): Node =>
  element("div", (el) =>
    host(el, {
      id: "h.c",
      input: Points,
      value: () => ("get" in value ? value.get() : value),
      live: "get" in value,
      code: () => Promise.resolve(code),
      events: more.onEvent === undefined ? undefined : Pick,
      onEvent: more.onEvent,
    }),
  );

describe("host op", () => {
  it("property: n writes in one frame call `update` once with the last value, `prev` the mounted one", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer(), { minLength: 1, maxLength: 6 }), async (ns) => {
        const step = frames();
        const first: P = { points: [] };
        const v = rootSignal(first);
        const { log, code } = probe();
        const off = mount(() => chart(code, v), root(), opts());
        await flush();
        step();
        const written = ns.map((n): P => ({ points: [n] }));
        for (const w of written) v.set(w);
        step();
        expect(log.mounts).toEqual([first]);
        expect(log.updates).toEqual([[written.at(-1), first]]);
        off();
        expect(log.disposes).toBe(1);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("removal through `If` before the import resolves runs nothing; after mount it disposes once", async () => {
    const step = frames();
    const on = rootSignal(true);
    const { log, code } = probe();
    mount(
      () =>
        If({
          get when() {
            return on.get();
          },
          children: () => chart(code, { points: [1] }),
        }),
      root(),
      opts(),
    );
    on.set(false);
    await flush();
    step();
    expect(log.mounts).toEqual([]);
    on.set(true);
    await flush();
    step();
    expect(log.mounts).toHaveLength(1);
    on.set(false);
    expect(log.disposes).toBe(1);
  });

  it("the server runs nothing and registers nothing", () => {
    const { log, code } = probe();
    serverMode.on = true;
    try {
      const r = root();
      mount(() => chart(code, { points: [1] }), r, opts());
      const el = r.firstElementChild;
      expect(el !== null && hosts.has(el)).toBe(false);
    } finally {
      serverMode.on = false;
    }
    expect(log.mounts).toEqual([]);
  });

  it("on a harness ctx the code never loads; the entry encodes the value and takes an `emit`", async () => {
    const step = frames();
    const ctx = createCtx({ mode: "sim", seed: SEED });
    harnessed().add(ctx);
    const seen: CtxEvent[] = [];
    observe(ctx, (e) => seen.push(e));
    const got: { at: number }[] = [];
    const r = root();
    let loads = 0;
    mount(
      () =>
        element("div", (el) =>
          host(el, {
            id: "h.c",
            input: Points,
            value: () => ({ points: [3] }),
            live: false,
            code: () => {
              loads += 1;
              return Promise.reject(new Error("never"));
            },
            events: Pick,
            onEvent: (e) => got.push(e),
          }),
        ),
      r,
      { ctx },
    );
    await flush();
    step();
    expect(loads).toBe(0);
    const el = r.firstElementChild;
    const entry = el === null ? undefined : hosts.get(el);
    expect(entry?.value()).toEqual({ points: [3] });
    expect(entry?.emit({ at: "x" })).toMatchObject({ code: "schema.invalid", data: { at: "h.c" } });
    expect(entry?.emit({ at: 2 })).toBeNull();
    expect(got).toEqual([{ at: 2 }]);
    expect(seen.filter((e) => e.kind === "fire")).toEqual([
      { kind: "fire", id: "h.c", event: { type: "emit", detail: { at: 2 } } },
    ]);
  });

  it("under `dev` a value failing `input` reaches the Boundary as `schema.invalid` with `data.at`; production passes it", async () => {
    const bad: P = JSON.parse('{"points":"x"}');
    const modes: ("dev" | "production")[] = ["dev", "production"];
    for (const mode of modes) {
      const step = frames();
      const fell: unknown[] = [];
      const { log, code } = probe();
      mount(
        () =>
          Boundary({
            children: () => chart(code, bad),
            fallback: (e) => {
              fell.push(e);
              return document.createElement("p");
            },
          }),
        root(),
        { ...opts(), mode },
      );
      await flush();
      step();
      if (mode === "dev") {
        expect(fell).toMatchObject([{ code: "schema.invalid", data: { at: "h.c" } }]);
        expect(log.mounts).toEqual([]);
      } else {
        expect(fell).toEqual([]);
        expect(log.mounts).toEqual([bad]);
      }
    }
  });

  it("an `emit` that fails `events` reaches the Boundary and calls nothing", async () => {
    const step = frames();
    const fell: unknown[] = [];
    const got: unknown[] = [];
    const { log, code } = probe();
    mount(
      () =>
        Boundary({
          children: () => chart(code, { points: [] }, { onEvent: (e) => got.push(e) }),
          fallback: (e) => {
            fell.push(e);
            return document.createElement("p");
          },
        }),
      root(),
      opts(),
    );
    await flush();
    step();
    log.emits[0]?.({ at: 1 });
    log.emits[0]?.({ at: "no" });
    expect(got).toEqual([{ at: 1 }]);
    expect(fell).toMatchObject([{ code: "schema.invalid", data: { at: "h.c" } }]);
    expect(log.disposes).toBe(1);
  });
});
