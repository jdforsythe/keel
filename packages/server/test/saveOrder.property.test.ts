// k.server Server state, backlog 0125: for any sequence of save outcomes (storage `set` resolves or rejects), the
// stored state and the copy a fresh request reads are the fold of the successful saves only.
// Seed: 1337 (fc.assert seed below).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { counterApp, fakeStorage, storedN, viewOf } from "./saveFixture.ts";

describe("saveStores outcomes (property)", () => {
  it("persisted and served state equal the fold of the successful saves", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }), async (outcomes) => {
        const fake = fakeStorage();
        const app = counterApp(fake.storage);
        let folded = 0;
        for (const succeeds of outcomes) {
          fake.plans.push(succeeds ? "ok" : "reject");
          expect((await app.inc()).status).toBe(succeeds ? 200 : 500);
          if (succeeds) folded += 1;
        }
        expect(storedN(fake.data)).toBe(folded === 0 ? null : folded);
        expect(await app.view()).toMatchObject(viewOf(folded));
      }),
      { seed: 1337, numRuns: 40 },
    );
  });
});
