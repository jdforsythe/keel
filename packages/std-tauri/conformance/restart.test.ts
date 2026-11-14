// Same clause as packages/std-capacitor/conformance/restart.test.ts: Conformance "A value `set` through one driver is read by a new driver over the same native store, as after an app restart."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumption: a restart is `world.restart()` (drops loaded store resources: only the saved `keel.json` survives) and a new `tauriDrivers` over the same store; a value a `true` `commit` stored is held to the same rule.
import { tauriDrivers } from "@keel/std-tauri";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { begin, end, ORIGIN, PAGES, type World } from "./fixtures.ts";

const run = { seed: 1337, numRuns: 100 };
const pairs = fc.uniqueArray(fc.tuple(fc.string({ minLength: 1, maxLength: 8 }), fc.string({ maxLength: 10 })), {
  minLength: 1,
  maxLength: 6,
  selector: (p) => p[0],
});
let world: World;

describe("std.shells: a value survives an app restart", () => {
  beforeEach(() => {
    world = begin(PAGES[0]);
  });
  afterEach(end);

  test.skip("A value `set` through one driver is read by a new driver over the same native store, as after an app restart", async () => {
    await fc.assert(
      fc.asyncProperty(pairs, async (ps) => {
        world.wipe();
        const first = tauriDrivers({ origin: ORIGIN }).storage;
        for (const [k, v] of ps) await first.set(k, v);
        world.restart();
        const second = tauriDrivers({ origin: ORIGIN }).storage;
        expect(second).not.toBe(first);
        for (const [k, v] of ps) expect(await second.get(k)).toBe(v);
        expect(await second.read(ps.map(([k]) => k))).toEqual(ps.map(([, v]) => v));
      }),
      run,
    );
  });

  test.skip("a value a `true` `commit` stored is read by a new driver over the same native store", async () => {
    await fc.assert(
      fc.asyncProperty(pairs, async (ps) => {
        world.wipe();
        const first = tauriDrivers({ origin: ORIGIN }).storage;
        expect(await first.commit(ps.map(([k, v]) => ({ key: k, expect: null, value: v })))).toBe(true);
        world.restart();
        const second = tauriDrivers({ origin: ORIGIN }).storage;
        expect(await second.read(ps.map(([k]) => k))).toEqual(ps.map(([, v]) => v));
      }),
      run,
    );
  });
});
