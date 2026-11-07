// @vitest-environment happy-dom
// Spec: std.sessions, clause "A redacted payload value never appears in the session JSON, and the redacted payload parses with its transaction's schema."
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { Session } from "@keel/std-sessions";
import { SEED, fixture, json, play } from "./fixtures.ts";

// Gap: the spec does not say how `record` obtains the redact list under a sim ctx (stdConfig is bound by createApp from .keel/std.json); a test hook or a createCtx option must be named.
// TODO 0092: unskip
describe.skip("std.sessions: redaction", () => {
  // Assumes the app module lists 'tx:cart.pay#card.number' and that config is bound to the ctx before `play`.
  test("A redacted payload value never appears in the session JSON", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 12, maxLength: 24 }), async (secret) => {
        const { session } = await play(SEED, [{ id: "cart.card", value: secret }]);
        expect(json(session)).not.toContain(JSON.stringify(secret).slice(1, -1));
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  test("and the redacted payload parses with its transaction's schema", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 12, maxLength: 24 }), async (secret) => {
        const { session } = await play(SEED, [{ id: "cart.card", value: secret }]);
        for (const e of session.events)
          if (e.kind === "tx" && e.name === "pay") expect(fixture().pay.schema.parse(e.payload).ok).toBe(true);
        expect(Session.parse(JSON.parse(json(session))).ok).toBe(true);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });
});
