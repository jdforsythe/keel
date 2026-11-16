// Spec: std.credentials, Conformance "Under real and sim, for generated secrets, `verify` of a secret and its `hash` is `ok`, `rehash` false; of another secret, `credentials.mismatch`."
// Spec: std.credentials, Conformance "A real `hash` has the stored form with `ln=17` and parses with `Hashed`; two of one secret differ."
// Spec: std.credentials, Conformance "`verify(secret, undefined)` is `credentials.mismatch`."
// Spec: std.credentials, Conformance "A secret with U+212B verifies against the `hash` of the same text with U+00C5."
// Seed: 1337.
// Assumption: "generated secrets" are non-empty strings of at most 40 characters (under the 1,024-byte limit), ASCII or from a small set of non-ASCII characters that NFKC leaves alone.
import { credentials } from "@keel/std-credentials/server";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, errorOf, hashedOf, isOk, okValue, realCtx, rehashOf, secretOf, simCtx } from "./fixtures.ts";

const secrets = fc.oneof(
  fc.string({ minLength: 1, maxLength: 40 }),
  fc.stringOf(fc.constantFrom("é", "日", "😀", "a", "b"), { minLength: 1, maxLength: 20 }),
);
const STORED = /^\$scrypt\$ln=17,r=8,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/;

async function hashText(ctx: Parameters<typeof credentials>[0], text: string): Promise<string> {
  const h = await credentials(ctx).hash(secretOf(text));
  if (!h.ok) throw new Error("hash refused a secret");
  return h.value;
}

test("Under real and sim, for generated secrets, `verify` of a secret and its `hash` is `ok`, `rehash` false; of another secret, `credentials.mismatch`. (sim)", async () => {
  await fc.assert(
    fc.asyncProperty(secrets, secrets, async (x, y) => {
      fc.pre(x.normalize("NFKC") !== y.normalize("NFKC"));
      const ctx = simCtx();
      const stored = hashedOf(await hashText(ctx, x));
      const same = await credentials(ctx).verify(secretOf(x), stored);
      expect(isOk(same)).toBe(true);
      expect(rehashOf(same)).toBe(false);
      const other = await credentials(ctx).verify(secretOf(y), stored);
      expect(errorOf(other).code).toBe("credentials.mismatch");
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("Under real and sim, for generated secrets, `verify` of a secret and its `hash` is `ok`, `rehash` false; of another secret, `credentials.mismatch`. (real)", async () => {
  await fc.assert(
    fc.asyncProperty(secrets, secrets, async (x, y) => {
      fc.pre(x.normalize("NFKC") !== y.normalize("NFKC"));
      const ctx = realCtx();
      const stored = hashedOf(await hashText(ctx, x));
      const same = await credentials(ctx).verify(secretOf(x), stored);
      expect(isOk(same)).toBe(true);
      expect(rehashOf(same)).toBe(false);
      const other = await credentials(ctx).verify(secretOf(y), stored);
      expect(errorOf(other).code).toBe("credentials.mismatch");
    }),
    { seed: SEED, numRuns: 5 },
  );
}, 120_000);

test("A real `hash` has the stored form with `ln=17` and parses with `Hashed`; two of one secret differ.", async () => {
  await fc.assert(
    fc.asyncProperty(secrets, async (x) => {
      const ctx = realCtx();
      const a = await hashText(ctx, x);
      const b = await hashText(ctx, x);
      expect(a).toMatch(STORED);
      expect(b).toMatch(STORED);
      expect(a).not.toBe(b);
      expect(hashedOf(a)).toBe(a);
    }),
    { seed: SEED, numRuns: 3 },
  );
}, 120_000);

test("`verify(secret, undefined)` is `credentials.mismatch`.", async () => {
  for (const ctx of [realCtx(), simCtx()]) {
    const r = await credentials(ctx).verify(secretOf("hunter2"), undefined);
    expect(errorOf(r).code).toBe("credentials.mismatch");
  }
}, 120_000);

test("A secret with U+212B verifies against the `hash` of the same text with U+00C5.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string({ maxLength: 8 }), fc.string({ maxLength: 8 }), async (pre, post) => {
      const ctx = simCtx();
      const stored = hashedOf(await hashText(ctx, `${pre}Å${post}`));
      const r = await credentials(ctx).verify(secretOf(`${pre}Å${post}`), stored);
      expect(isOk(r)).toBe(true);
      expect(rehashOf(r)).toBe(false);
    }),
    { seed: SEED, numRuns: 50 },
  );
  const ctx = realCtx();
  const stored = hashedOf(await hashText(ctx, "pÅss"));
  const r = await credentials(ctx).verify(secretOf("pÅss"), stored);
  expect(okValue(r)).toEqual({ rehash: false });
  const back = await credentials(ctx).verify(secretOf("pÅss"), hashedOf(await hashText(ctx, "pÅss")));
  expect(isOk(back)).toBe(true);
}, 120_000);
