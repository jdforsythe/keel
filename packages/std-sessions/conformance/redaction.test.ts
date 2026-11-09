// @vitest-environment happy-dom
// Spec: std.sessions, clause "A redacted payload value never appears in the session JSON, and the redacted payload parses with its transaction's schema."
// Seed 1337
import { Session } from "@keel/std-sessions";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, fixture, json, play } from "./fixtures.ts";

describe("std.sessions: redaction", () => {
  // The module lists the payload path and the card input (`el:`), which carries the same value; `play` binds them.
  const redact = ["tx:cart.pay#card.number", "el:cart.card#value"];
  test("A redacted payload value never appears in the session JSON", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 12, maxLength: 24 }), async (secret) => {
        const { session } = await play(SEED, [{ id: "cart.card", value: secret }], { redact });
        expect(json(session)).not.toContain(JSON.stringify(secret).slice(1, -1));
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  test("and the redacted payload parses with its transaction's schema", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 12, maxLength: 24 }), async (secret) => {
        const { session } = await play(SEED, [{ id: "cart.card", value: secret }], { redact });
        for (const e of session.events)
          if (e.kind === "tx" && e.name === "cart.pay") expect(fixture().pay.schema.parse(e.payload).ok).toBe(true);
        expect(Session.parse(JSON.parse(json(session))).ok).toBe(true);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });
});
