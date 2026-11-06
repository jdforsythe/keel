// @vitest-environment happy-dom
// fast-check seed: 1337
import { err } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { RUNS, SEED, VALID, setup } from "./fixtures.ts";

test("any other err renders in the error slot and leaves values intact", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom("keel.unexpected", "keel.denied", "keel.notFound", "api.timeout"),
      fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{2,20}$/),
      async (code, message) => {
        const h = setup();
        try {
          h.fill(VALID);
          const before = h.f.values();
          h.handler.current = () => err({ code, message, data: null });
          await h.submit();
          const slot = h.root.querySelector('[data-slot="error"]');
          expect(slot?.textContent).toContain(message);
          expect(h.f.values()).toEqual(before);
          expect(h.f.errors()).toEqual({});
        } finally {
          h.dispose();
        }
      },
    ),
    { seed: SEED, numRuns: RUNS },
  );
});
