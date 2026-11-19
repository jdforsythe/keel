// Spec: std.credentials, Modes "**sim.** The form is `$scrypt-sim$ln=<ln>,r=8,p=1$<salt>$<key>`: `ln` is the ctx's, as a label; the key is derived synchronously at N = 2^4, and the salt comes from the capability seed and a call count. It reads both forms. A real or shell ctx refuses it, so a string with a seeded salt verifies only under sim."
// Spec: std.credentials, Conformance "Under sim, ctxs with one seed give equal `hash` strings call by call, and two seeds do not; a sim `hash` and every generated `Hashed` are `credentials.malformed` `sim` under real and shell."
// Seed: 1337.
// Assumption: "equal `hash` strings call by call" is read for the first three calls with one secret, "two seeds do not" for the first call.
// Assumption: "every generated `Hashed`" is 50 values of `gen(Hashed)` (`@keel/schema/gen`), sampled with seed 1337.
// Untestable: "the key is derived synchronously at N = 2^4" is an internal cost; no public result shows N.
import { gen } from "@keel/schema/gen";
import { Hashed } from "@keel/std-credentials";
import { credentials } from "@keel/std-credentials/server";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, errorOf, hashedOf, isOk, realCtx, rehashOf, secretOf, shellCtx, simCtx } from "./fixtures.ts";

const seeds = fc.integer({ min: 0, max: 2 ** 31 - 1 });
const secrets = fc.string({ minLength: 1, maxLength: 30 });

async function hashText(ctx: Parameters<typeof credentials>[0], text: string): Promise<string> {
  const h = await credentials(ctx).hash(secretOf(text));
  if (!h.ok) throw new Error("hash refused a secret");
  return h.value;
}

test("Under sim, ctxs with one seed give equal `hash` strings call by call, and two seeds do not.", async () => {
  await fc.assert(
    fc.asyncProperty(seeds, seeds, secrets, async (a, b, text) => {
      fc.pre(a !== b);
      const one = simCtx(a);
      const two = simCtx(a);
      for (let i = 0; i < 3; i++) expect(await hashText(one, text)).toBe(await hashText(two, text));
      expect(await hashText(simCtx(a), text)).not.toBe(await hashText(simCtx(b), text));
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("A sim `hash` starts `$scrypt-sim$ln=17,`.", async () => {
  await fc.assert(
    fc.asyncProperty(seeds, secrets, async (seed, text) => {
      expect(await hashText(simCtx(seed), text)).toMatch(/^\$scrypt-sim\$ln=17,r=8,p=1\$/);
    }),
    { seed: SEED, numRuns: 50 },
  );
});

test("A sim `hash` and every generated `Hashed` are `credentials.malformed` `sim` under real and shell. (sim hash)", async () => {
  await fc.assert(
    fc.asyncProperty(seeds, secrets, async (seed, text) => {
      const sim = hashedOf(await hashText(simCtx(seed), text));
      for (const ctx of [realCtx(), shellCtx()]) {
        const e = errorOf(await credentials(ctx).verify(secretOf(text), sim));
        expect(e.code).toBe("credentials.malformed");
        expect(e.data).toEqual({ reason: "sim" });
      }
    }),
    { seed: SEED, numRuns: 10 },
  );
}, 120_000);

test("A sim `hash` and every generated `Hashed` are `credentials.malformed` `sim` under real and shell. (generated)", async () => {
  const sample = fc.sample(gen(Hashed), { seed: SEED, numRuns: 50 });
  expect(sample).toHaveLength(50);
  for (const ctx of [realCtx(), shellCtx()]) {
    for (const stored of sample) {
      const e = errorOf(await credentials(ctx).verify(secretOf("hunter2"), stored));
      expect(e.code, stored).toBe("credentials.malformed");
      expect(e.data, stored).toEqual({ reason: "sim" });
    }
  }
}, 120_000);

test("A sim ctx verifies a real `hash` (it reads both forms).", async () => {
  const real = realCtx();
  const stored = hashedOf(await hashText(real, "hunter2"));
  const sim = simCtx();
  const ok = await credentials(sim).verify(secretOf("hunter2"), stored);
  expect(isOk(ok)).toBe(true);
  expect(rehashOf(ok)).toBe(false);
  expect(errorOf(await credentials(sim).verify(secretOf("hunter3"), stored)).code).toBe("credentials.mismatch");
  const own = hashedOf(await hashText(sim, "hunter2"));
  expect(isOk(await credentials(sim).verify(secretOf("hunter2"), own))).toBe(true);
}, 120_000);
