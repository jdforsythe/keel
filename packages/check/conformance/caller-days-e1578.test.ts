// k.user, Rules "E1578 `caller` on a deployable other than `node`, or `days` not an integer 1 to 400 · E1579 `identity.server.ts` without a default `identity(...)` export, or a `handle.path` not of lowercase `/` segments, or with a route of any deployable at or under it (`keel check`, `keel build`; `createApp` throws it). Fix: none."
// Spec: k.user, clause "`caller: { days: 0 }`, `{ days: 401 }`, `{ days: 1.5 }`, `caller` on a `client` deployable, and `handle.path` `/api` with a route `/api/x` are each one diagnostic (E1578, E1579)."
// k.user, Caller lifetime "A `node` deployable may set `caller: { days }` in `topology.ts` (an integer 1 to 400)"
// Seed 1337 (fc.assert below). The E1579 cases are identity-source-e1579.test.ts and packages/cli/conformance/identity-e1579-build.test.ts.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const MANIFEST = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const project = (adapter: string, caller: string): Files => [
  {
    path: "topology.ts",
    source: `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['a'], adapter: '${adapter}', ${caller} } })\n`,
  },
  { path: "modules/a/module.ts", source: MANIFEST("a") },
];
const e1578 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1578");

describe("k.user: E1578", () => {
  test("`caller: { days: 0 }`, `{ days: 401 }` and `{ days: 1.5 }` are each one E1578", () => {
    for (const days of ["0", "401", "1.5"]) expect(e1578(project("node", `caller: { days: ${days} }`))).toHaveLength(1);
  });

  test("`days` not an integer 1 to 400 is one E1578, and an integer 1 to 400 on a `node` deployable is none", async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          fc.constant("0"),
          fc.integer({ min: 401, max: 100_000 }).map(String),
          fc.tuple(fc.integer({ min: 0, max: 500 }), fc.integer({ min: 1, max: 9 })).map(([a, b]) => `${a}.${b}`),
        ),
        fc.integer({ min: 1, max: 400 }),
        (bad, good) => {
          expect(e1578(project("node", `caller: { days: ${bad} }`))).toHaveLength(1);
          expect(e1578(project("node", `caller: { days: ${good} }`))).toEqual([]);
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });

  test("`days: 1` and `days: 400` on a `node` deployable are clean", () => {
    for (const days of [1, 400]) expect(e1578(project("node", `caller: { days: ${days} }`))).toEqual([]);
  });

  test("`caller` on a `client` deployable is one E1578, and on a `static` one too", () => {
    for (const adapter of ["client", "static"]) {
      expect(e1578(project(adapter, "caller: { days: 30 }"))).toHaveLength(1);
    }
  });

  test("a deployable with no `caller` option has no E1578, and E1578 has no fix", () => {
    expect(e1578(project("node", ""))).toEqual([]);
    expect(e1578(project("client", ""))).toEqual([]);
    const [d] = e1578(project("node", "caller: { days: 0 }"));
    expect(d?.fix ?? null).toBeNull();
  });
});
