// Spec: k.user, Conformance "With `caller: { days: 30 }`, `pii.json` has `caller: { days: 30, class: 'network' }`; without it, `{ days: null, class: null }`."
// Spec: k.user, Caller lifetime "The caller hash is then a long-lived device identifier: k.privacy treats it as `.pii('network')`, and the evidence bundle's `pii.json` holds `caller: { days, class: 'network' }` (`{ days: null, class: null }` without it)."
// Seed 1337 (the days are drawn with fc.sample). The real `keel` binary over a temp project, as the other evidence files do.
// The std.sessions half is packages/std-sessions/conformance/caller-network.test.ts.
import { rmSync } from "node:fs";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { SEED, TEST_KEY_PEM, fixtureTree, parseJson, project, readTree, writeBundle } from "./evidence-fixture.ts";

const SLOW = 600_000;
const cleanups: string[] = [];
afterAll(() => {
  for (const d of cleanups) rmSync(d, { recursive: true, force: true });
});

const topologyWith = (caller: string): Record<string, string> => ({
  "topology.ts": `import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['a'], adapter: 'node'${caller} },\n  app: { modules: ['c'], adapter: 'client' },\n})\n`,
});

function callerOf(caller: string): unknown {
  const dir = project(fixtureTree({ extra: topologyWith(caller) }));
  const { out, base, run } = writeBundle(dir, TEST_KEY_PEM);
  cleanups.push(dir, base);
  expect(run.status).toBe(0);
  const pii: unknown = parseJson(readTree(out).get("pii.json"));
  return typeof pii === "object" && pii !== null && "caller" in pii ? pii.caller : undefined;
}

describe("k.user: pii.json and the persistent caller", () => {
  test(
    "With `caller: { days: 30 }`, `pii.json` has `caller: { days: 30, class: 'network' }`",
    () => {
      expect(callerOf(", caller: { days: 30 }")).toEqual({ days: 30, class: "network" });
    },
    SLOW,
  );

  test(
    "without `caller`, `pii.json` has `caller: { days: null, class: null }`",
    () => {
      expect(callerOf("")).toEqual({ days: null, class: null });
    },
    SLOW,
  );

  test(
    "`pii.json` records the `days` the node deployable set, whatever integer 1 to 400",
    () => {
      const [days] = fc.sample(fc.integer({ min: 1, max: 400 }), { seed: SEED, numRuns: 1 });
      expect(callerOf(`, caller: { days: ${String(days)} }`)).toEqual({ days, class: "network" });
    },
    SLOW,
  );
});
