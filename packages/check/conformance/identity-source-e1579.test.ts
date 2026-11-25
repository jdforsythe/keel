// k.user, Rules "E1579 `identity.server.ts` without a default `identity(...)` export, or a `handle.path` not of lowercase `/` segments, or with a route of any deployable at or under it (`keel check`, `keel build`; `createApp` throws it). Fix: none."
// Spec: k.user, clause "`caller: { days: 0 }`, `{ days: 401 }`, `{ days: 1.5 }`, `caller` on a `client` deployable, and `handle.path` `/api` with a route `/api/x` are each one diagnostic (E1578, E1579)."
// Seed 1337 (fc.assert below). The route collision is packages/cli/conformance/identity-e1579-build.test.ts; `createApp` throwing is packages/server/conformance/identity-e1579.test.ts.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const HEAD = "import { identity } from '@keel/server'\n";
const file = (source: string): Files => [{ path: "identity.server.ts", source }];
const e1579 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1579");
const withHandle = (p: string): Files =>
  file(
    `${HEAD}export default identity({ identify: async () => '', handle: { path: '${p}', fn: () => new Response('') } })\n`,
  );

describe("k.user: E1579 in the identity source", () => {
  test("an `identity.server.ts` with a default `identity(...)` export is clean", () => {
    expect(e1579(file(`${HEAD}export default identity({ identify: async () => '' })\n`))).toEqual([]);
  });

  test("an `identity.server.ts` with no default export is one E1579", () => {
    expect(e1579(file(`${HEAD}export const identity = async () => ''\n`))).toHaveLength(1);
    expect(e1579(file(""))).toHaveLength(1);
  });

  test("an `identity.server.ts` whose default export is not an `identity(...)` call is one E1579", () => {
    expect(e1579(file("export default { identify: async () => '' }\n"))).toHaveLength(1);
    expect(e1579(file("export default async () => ''\n"))).toHaveLength(1);
  });

  test("a `handle.path` of `api` (no leading `/`) or `/API` is one E1579", () => {
    for (const p of ["api", "/API", "/api/Auth"]) expect(e1579(withHandle(p))).toHaveLength(1);
  });

  test("a `handle.path` of lowercase `/` segments is clean", async () => {
    await fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/), { minLength: 1, maxLength: 4 }), (segments) => {
        expect(e1579(withHandle(`/${segments.join("/")}`))).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("E1579 has no fix", () => {
    const [d] = e1579(withHandle("api"));
    expect(d?.fix ?? null).toBeNull();
  });

  test("a project with no `identity.server.ts` has no E1579", () => {
    expect(e1579([{ path: "topology.ts", source: "export default {}\n" }])).toEqual([]);
  });
});
