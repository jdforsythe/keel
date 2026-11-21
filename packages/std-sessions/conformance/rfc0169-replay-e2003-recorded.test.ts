// @vitest-environment happy-dom
// Spec: k.parity, clause "a replay whose third input cannot apply records one E2003 `error` (`data.at` `sessions.replay`), and its `reproduced` is false."
// Seed 1337
// The std.sessions sentence "An input it cannot apply is E2003, so the fingerprint differs." is unchanged by rfc:0169; the existing E2003 conformance headers quote other clauses and need no requote.
import { replay } from "@keel/std-sessions/replay";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, cartContract, cartRoutes, play } from "./fixtures.ts";

describe("rfc:0169 conformance: a replay records its own E2003", () => {
  test("rfc:0169 conformance: a replay whose third input cannot apply records one E2003 error with data.at sessions.replay, and its reproduced is false", async () => {
    const { session } = await play(SEED, []);
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("no.such.id", "x", "cart.nope"), async (id) => {
        const href = cartContract.href("cart.show");
        const events = [
          { at: 0, kind: "nav" as const, href },
          { at: 0, kind: "nav" as const, href },
          { at: 0, kind: "fire" as const, id, event: { type: "click" as const } },
        ];
        const r = await replay({ ...session, events }, { routes: cartRoutes() });
        expect(r.unapplied).toBe(2);
        const errors = r.observed.filter((e) => e.kind === "error");
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({ kind: "error", error: { code: "E2003", data: { at: "sessions.replay" } } });
        expect(r.reproduced).toBe(false);
      }),
      { seed: SEED, numRuns: 10 },
    );
  }, 60_000);
});
