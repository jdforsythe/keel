// Spec: k.persist, Conformance "`read(keys)` returns each key's value in the order asked, `null` for an absent key."
// Seed: 1337.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { fileStorage } from "@keel/ctx/node";
import fc from "fast-check";
import { afterAll, expect, it } from "vitest";

const SEED = 1337;
const dir = mkdtempSync(join(tmpdir(), "keel-storage-read-"));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

let n = 0;
// The same contract holds on a sim ctx and on a real ctx over a file driver.
const makers: ReadonlyArray<() => Ctx> = [
  () => createCtx({ mode: "sim", seed: SEED }),
  () => createCtx({ mode: "real", drivers: { storage: fileStorage(join(dir, `r${String(n++)}.json`)) } }),
];

const keyArb = fc.string({ maxLength: 6 });

it("`read(keys)` returns each key's value in the order asked, `null` for an absent key", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.uniqueArray(keyArb, { maxLength: 8 }),
      fc.uniqueArray(keyArb, { maxLength: 8 }),
      fc.array(fc.string({ maxLength: 6 }), { minLength: 8, maxLength: 8 }),
      fc.nat(),
      async (present, absent, values, shift) => {
        const stored = new Map<string, string>();
        present.forEach((k, i) => {
          stored.set(k, values[i] ?? "");
        });
        // Ask for stored keys and keys never stored, in an order that is neither insertion nor sorted order.
        const asked = [...present, ...absent.filter((k) => !stored.has(k))];
        const cut = asked.length === 0 ? 0 : shift % asked.length;
        const order = [...asked.slice(cut), ...asked.slice(0, cut)].reverse();
        for (const make of makers) {
          const ctx = make();
          for (const [k, v] of stored) await ctx.storage.set(k, v);
          const got = await ctx.storage.read(order);
          expect(got).toEqual(order.map((k) => stored.get(k) ?? null));
        }
      },
    ),
    { seed: SEED, numRuns: 50 },
  );
});
