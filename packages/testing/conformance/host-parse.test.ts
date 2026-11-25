// @vitest-environment happy-dom
// Spec: k.host-element, clause "Under `mode: 'dev'` a `value` that fails `input` renders the nearest `Boundary`'s fallback with `data.at` the element's id and calls no `mount`; without `mode`, `mount` gets the same value as given."
// k.host-element, Parse "Under `mount` or `resume` with `mode: 'dev'` (`keel dev`) and in the harness, `input` parses each value before `mount` or `update` gets it, and in the harness before `find(id).value` encodes it. A value that fails is a `KeelError` `schema.invalid` thrown to the nearest `Boundary` (`data.at` the element's id), and neither `mount` nor `update` runs with it. Production (`mode` `'production'`, the default) does not parse: the value reaches the code as typed, unchecked."
// Seed: 1337. The harness half is in host-harness.test.ts.
import { Boundary, mount } from "@keel/runtime-dom";
import { Host } from "@keel/ui";
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Points, type PointsValue, SEED, flush, frames, probe, simCtx } from "./host-support.ts";
import { cleanup, host, signal } from "./host-dom.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const errorOf = (e: unknown): { code: string; at: string } => {
  const o = typeof e === "object" && e !== null ? e : {};
  const code = "code" in o ? String(o.code) : "";
  const data = "data" in o && typeof o.data === "object" && o.data !== null ? o.data : {};
  return { code, at: "at" in data ? String(data.at) : "" };
};

/** A value that fails `Points` at runtime; the fixture builds it from JSON so no cast is needed. */
const bad = (): PointsValue => JSON.parse('{"points":"not an array"}');

const setup = async (value: PointsValue | ReturnType<typeof signal<PointsValue>>, mode?: "dev" | "production") => {
  const f = frames();
  const p = probe();
  const fell: { code: string; at: string }[] = [];
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
            value,
            code: () => Promise.resolve(p.code),
          }),
        fallback: (e: unknown) => {
          fell.push(errorOf(e));
          return document.createElement("p");
        },
      }),
    root,
    mode === undefined ? { ctx: simCtx() } : { ctx: simCtx(), mode },
  );
  await flush();
  f.step();
  await flush();
  f.step();
  return { f, ...p, fell };
};

describe("k.host-element: input is parsed under dev", () => {
  test("under `mode: 'dev'` a `value` that fails `input` is `schema.invalid` to the nearest `Boundary` with `data.at` the element's id, and calls no `mount`", async () => {
    const { log, fell } = await setup(bad(), "dev");
    expect(fell).toEqual([{ code: "schema.invalid", at: "h.chart" }]);
    expect(log.mounts).toEqual([]);
    expect(log.updates).toEqual([]);
  });

  test("under `mode: 'dev'` a later `value` that fails `input` calls no `update` and reaches the `Boundary`", async () => {
    const sig = signal<PointsValue>({ points: [1] });
    const { f, log, fell } = await setup(sig, "dev");
    expect(log.mounts).toHaveLength(1);
    expect(fell).toEqual([]);
    sig.set(bad());
    await flush();
    f.step();
    await flush();
    expect(log.updates).toEqual([]);
    expect(fell).toEqual([{ code: "schema.invalid", at: "h.chart" }]);
  });

  test("property: under `mode: 'dev'` a value that parses reaches `mount` as given", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer(), { maxLength: 6 }), async (points) => {
        const given: PointsValue = { points };
        const { log, fell } = await setup(given, "dev");
        expect(fell).toEqual([]);
        expect(log.mounts[0]?.value).toEqual(given);
        vi.unstubAllGlobals();
        cleanup();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("without `mode` (production) `input` is not parsed: `mount` gets the same value as given", async () => {
    const given = bad();
    const { log, fell } = await setup(given);
    expect(fell).toEqual([]);
    expect(log.mounts).toHaveLength(1);
    expect(log.mounts[0]?.value).toBe(given);
  });

  test("with `mode: 'production'` `input` is not parsed: `update` gets the same value as given", async () => {
    const sig = signal<PointsValue>({ points: [1] });
    const { f, log, fell } = await setup(sig, "production");
    const given = bad();
    sig.set(given);
    await flush();
    f.step();
    expect(fell).toEqual([]);
    expect(log.updates[0]?.value).toBe(given);
  });
});
