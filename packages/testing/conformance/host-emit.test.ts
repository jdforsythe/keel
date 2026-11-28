// @vitest-environment happy-dom
// Spec: k.host-code, clause "`emit(e)` with an `e` that parses calls `onEvent` once and reaches an observer as a `fire` of `type: 'emit'`; one that fails `events` calls nothing and reaches the `Boundary`."
// k.host-code, Events "`emit(e)` parses `e` with `events`, reports `{ kind: 'fire', id, event: { type: 'emit', detail: e } }` to the ctx observers, then calls `onEvent(e)` as a handler: what the app does with it is a transaction, so it is logged, recorded in a session and replayed without the outside code."
// Seed: 1337.
import { observe } from "@keel/ctx";
import type { CtxEvent } from "@keel/ctx";
import { Boundary, mount } from "@keel/runtime-dom";
import { Host } from "@keel/ui";
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, host } from "./host-dom.ts";
import { Pick, Points, SEED, flush, frames, probe, simCtx } from "./host-support.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const setup = async (onEvent: (e: { at: number }) => void = () => undefined) => {
  const f = frames();
  const { log, code } = probe();
  const ctx = simCtx();
  const seen: CtxEvent[] = [];
  observe(ctx, (e) => seen.push(e));
  const got: unknown[] = [];
  const fell: unknown[] = [];
  const root = host();
  mount(
    () =>
      Boundary({
        children: () =>
          Host({
            id: "h.chart",
            role: "img",
            label: "Chart",
            input: Points,
            value: { points: [1] },
            events: Pick,
            onEvent: (e: { at: number }) => {
              got.push(e);
              onEvent(e);
            },
            code: () => Promise.resolve(code),
          }),
        fallback: (e: unknown) => {
          fell.push(e);
          return document.createElement("p");
        },
      }),
    root,
    { ctx },
  );
  await flush();
  f.step();
  await flush();
  const out = log.outs[0];
  if (out === undefined) throw new Error("fixture: mount did not run");
  return { out, got, fell, seen, root };
};

describe("k.host-code: emit", () => {
  test("`emit(e)` with an `e` that parses calls `onEvent` once and reaches an observer as a `fire` of `type: 'emit'`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -1000, max: 1000 }), async (at) => {
        const { out, got, seen } = await setup();
        out.emit({ at });
        await flush();
        expect(got).toEqual([{ at }]);
        const fires = seen.filter((e) => e.kind === "fire");
        expect(fires).toHaveLength(1);
        expect(fires[0]).toMatchObject({ kind: "fire", id: "h.chart", event: { type: "emit", detail: { at } } });
        vi.unstubAllGlobals();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("an `emit` that fails `events` calls nothing and reaches the `Boundary`", async () => {
    const { out, got, fell, seen } = await setup();
    Reflect.apply(out.emit, out, [{ at: "not a number" }]);
    await flush();
    expect(got).toEqual([]);
    expect(seen.filter((e) => e.kind === "fire")).toEqual([]);
    expect(fell).toHaveLength(1);
    expect(fell[0]).toMatchObject({ code: "schema.invalid", data: { at: "h.chart" } });
  });

  test("a throw from `onEvent` reaches the `Boundary` with `data.at` the element's id", async () => {
    const { out, fell } = await setup(() => {
      throw new Error("handler failed");
    });
    out.emit({ at: 1 });
    await flush();
    expect(fell).toHaveLength(1);
    expect(fell[0]).toMatchObject({ data: { at: "h.chart" } });
  });
});
