// Spec: std.tokens, Modes "Real and shell draw `id` and `secret` from `randomBytes` of `node:crypto`. Sim draws them from the capability seed and a call count and writes `keelsim_<id>_<secret>` and `$sha256-sim$...`; it reads both forms."
// Spec: std.tokens, Modes "A real or shell ctx answers `credentials.mismatch` for a sim token and `credentials.malformed` `sim` for a sim digest."
// Spec: std.tokens, Conformance "Under sim, ctxs with one seed mint equal tokens and digests call by call, and two seeds do not; under real and shell, a sim token is `credentials.mismatch`, and a row with a sim digest or any generated `Digested` is `credentials.malformed` `sim`."
// Seed: 1337.
// Assumption: "equal call by call" is read for the first three mints with `ttl: null`; "two seeds do not" for the first mint.
// Assumption: "any generated `Digested`" is 50 values of `gen(Digested)` (`@keel/schema/gen`) sampled with seed 1337, presented with a real token.
// Assumption: `ttl: null` is used so the digest does not depend on the clock.
// Untestable: that real and shell draw from `randomBytes` and not `ctx.random` is not observable; the real mints differ, which `mint.test.ts` shows.
import { gen } from "@keel/schema/gen";
import { Digested } from "@keel/std-credentials";
import { credentials } from "@keel/std-credentials/server";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, digestedOf, errorOf, isOk, realCtx, secretOf, shellCtx, simCtx, textOf } from "./fixtures.ts";

const seeds = fc.integer({ min: 0, max: 2 ** 31 - 1 });

function mintOne(ctx: Parameters<typeof credentials>[0]): { text: string; digest: string; id: string } {
  const m = credentials(ctx).mint({ ttl: null });
  if (!m.ok) throw new Error("mint refused a ttl");
  return { text: textOf(m.value.token), digest: m.value.digest, id: m.value.id };
}

test("Under sim, ctxs with one seed mint equal tokens and digests call by call, and two seeds do not.", () => {
  fc.assert(
    fc.property(seeds, seeds, (a, b) => {
      fc.pre(a !== b);
      const one = simCtx(a);
      const two = simCtx(a);
      for (let i = 0; i < 3; i++) expect(mintOne(one)).toEqual(mintOne(two));
      const x = mintOne(simCtx(a));
      const y = mintOne(simCtx(b));
      expect(x.text).not.toBe(y.text);
      expect(x.digest).not.toBe(y.digest);
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("Sim draws them from the capability seed and a call count and writes `keelsim_<id>_<secret>` and `$sha256-sim$...`; it reads both forms.", () => {
  fc.assert(
    fc.property(seeds, (seed) => {
      const sim = simCtx(seed);
      const m = mintOne(sim);
      expect(m.text).toMatch(/^keelsim_[0-9a-f]{16}_[0-9a-f]{64}$/);
      expect(m.digest.startsWith("$sha256-sim$")).toBe(true);
      expect(isOk(credentials(sim).check(secretOf(m.text), () => ({ id: m.id, digest: digestedOf(m.digest) })))).toBe(
        true,
      );
      const real = mintOne(realCtx());
      const r = credentials(sim).check(secretOf(real.text), () => ({ id: real.id, digest: digestedOf(real.digest) }));
      expect(isOk(r)).toBe(true);
    }),
    { seed: SEED, numRuns: 50 },
  );
});

test("Under real and shell, a sim token is `credentials.mismatch`.", () => {
  fc.assert(
    fc.property(seeds, (seed) => {
      const m = mintOne(simCtx(seed));
      for (const ctx of [realCtx(), shellCtx()]) {
        const r = credentials(ctx).check(secretOf(m.text), () => ({ id: m.id, digest: digestedOf(m.digest) }));
        expect(errorOf(r).code).toBe("credentials.mismatch");
      }
    }),
    { seed: SEED, numRuns: 50 },
  );
});

test("Under real and shell, a row with a sim digest or any generated `Digested` is `credentials.malformed` `sim`.", () => {
  const sample = fc.sample(gen(Digested), { seed: SEED, numRuns: 50 });
  expect(sample).toHaveLength(50);
  fc.assert(
    fc.property(seeds, (seed) => {
      const simDigest = digestedOf(mintOne(simCtx(seed)).digest);
      for (const ctx of [realCtx(), shellCtx()]) {
        const real = mintOne(ctx);
        const r = credentials(ctx).check(secretOf(real.text), () => ({ id: real.id, digest: simDigest }));
        expect(errorOf(r).code).toBe("credentials.malformed");
        expect(errorOf(r).data).toEqual({ reason: "sim" });
      }
    }),
    { seed: SEED, numRuns: 20 },
  );
  for (const ctx of [realCtx(), shellCtx()]) {
    const real = mintOne(ctx);
    for (const digest of sample) {
      const r = credentials(ctx).check(secretOf(real.text), () => ({ id: real.id, digest }));
      expect(errorOf(r).code, digest).toBe("credentials.malformed");
      expect(errorOf(r).data, digest).toEqual({ reason: "sim" });
    }
  }
});
