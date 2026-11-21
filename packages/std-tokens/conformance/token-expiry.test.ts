// Spec: std.tokens, API "A matching token whose digest has an expiry at or before now is `credentials.expired`."
// Spec: std.tokens, API "The expiry is in `digest`, so the app stores no other field for `check` to read."
// Spec: std.tokens, Conformance "Under sim, a token minted at clock 0 with `ttl` 3,600,000 is `ok` after `advance(3599999)`, `credentials.expired` after one more millisecond and after any later `advance`; a `ttl: null` token is `ok` after `advance(1e12)`."
// Spec: std.tokens, Conformance "Another token presented against an expired row is `credentials.mismatch`, never `credentials.expired`."
// Seed: 1337.
// Assumption: the real case replaces `exp=<ms>` of a minted digest with `exp=1`; the digest part is the token's hash, which `exp` does not enter.
// Assumption: "the app stores no other field" is shown by presenting the row `{ digest }` alone (no `id`) and reading its verdict.
import { tokens } from "@keel/std-tokens/server";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, digestedOf, errorOf, isOk, realCtx, secretOf, simCtx, textOf } from "./fixtures.ts";

const TTL = 3_600_000;

test("Under sim, a token minted at clock 0 with `ttl` 3,600,000 is `ok` after `advance(3599999)`, `credentials.expired` after one more millisecond and after any later `advance`; a `ttl: null` token is `ok` after `advance(1e12)`. (boundary)", async () => {
  const ctx = simCtx();
  const m = tokens(ctx).mint({ ttl: TTL });
  if (!m.ok) throw new Error("mint refused a ttl");
  const row = { id: m.value.id, digest: m.value.digest };
  const token = m.value.token;
  const verdict = () => tokens(ctx).check(token, () => row);
  expect(isOk(verdict())).toBe(true);
  await ctx.clock.advance(3_599_999);
  expect(isOk(verdict())).toBe(true);
  await ctx.clock.advance(1);
  expect(ctx.clock.now()).toBe(m.value.expiresAt);
  expect(errorOf(verdict()).code).toBe("credentials.expired");
  await ctx.clock.advance(1_000_000);
  expect(errorOf(verdict()).code).toBe("credentials.expired");
});

test("Under sim, a token minted at clock 0 with `ttl` 3,600,000 is `ok` after `advance(3599999)`, `credentials.expired` after one more millisecond and after any later `advance`; a `ttl: null` token is `ok` after `advance(1e12)`. (no expiry)", async () => {
  const ctx = simCtx();
  const m = tokens(ctx).mint({ ttl: null });
  if (!m.ok) throw new Error("mint refused a ttl");
  await ctx.clock.advance(1e12);
  expect(isOk(tokens(ctx).check(m.value.token, () => ({ id: m.value.id, digest: m.value.digest })))).toBe(true);
});

test("A matching token whose digest has an expiry at or before now is `credentials.expired`. (property: ok exactly while now < expiresAt)", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 60_000, max: 31_536_000_000 }),
      fc.array(fc.integer({ min: 0, max: 20_000_000_000 }), { minLength: 1, maxLength: 6 }),
      async (ttl, steps) => {
        const ctx = simCtx();
        const m = tokens(ctx).mint({ ttl });
        if (!m.ok) throw new Error("mint refused a ttl");
        const row = { id: m.value.id, digest: m.value.digest };
        const expiresAt = m.value.expiresAt;
        for (const step of steps) {
          await ctx.clock.advance(step);
          const r = tokens(ctx).check(m.value.token, () => row);
          if (ctx.clock.now() < (expiresAt ?? 0)) expect(isOk(r)).toBe(true);
          else expect(errorOf(r).code).toBe("credentials.expired");
        }
      },
    ),
    { seed: SEED, numRuns: 100 },
  );
});

test("Another token presented against an expired row is `credentials.mismatch`, never `credentials.expired`.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 60_000, max: 1_000_000 }), async (ttl) => {
      const ctx = simCtx();
      const a = tokens(ctx).mint({ ttl });
      const b = tokens(ctx).mint({ ttl });
      if (!a.ok || !b.ok) throw new Error("mint refused a ttl");
      await ctx.clock.advance(ttl);
      const row = { id: a.value.id, digest: a.value.digest };
      expect(errorOf(tokens(ctx).check(a.value.token, () => row)).code).toBe("credentials.expired");
      expect(errorOf(tokens(ctx).check(b.value.token, () => row)).code).toBe("credentials.mismatch");
    }),
    { seed: SEED, numRuns: 30 },
  );
});

test("A matching token whose digest has an expiry at or before now is `credentials.expired`. (real)", () => {
  const ctx = realCtx();
  const m = tokens(ctx).mint({ ttl: 60_000 });
  if (!m.ok) throw new Error("mint refused a ttl");
  const fresh = tokens(ctx).check(m.value.token, () => ({ id: m.value.id, digest: m.value.digest }));
  expect(isOk(fresh)).toBe(true);
  const past = digestedOf(m.value.digest.replace(/exp=\d+/, "exp=1"));
  expect(past).not.toBe(m.value.digest);
  const r = tokens(ctx).check(secretOf(textOf(m.value.token)), () => ({ id: m.value.id, digest: past }));
  expect(errorOf(r).code).toBe("credentials.expired");
});

test("The expiry is in `digest`, so the app stores no other field for `check` to read.", async () => {
  const ctx = simCtx();
  const m = tokens(ctx).mint({ ttl: TTL });
  if (!m.ok) throw new Error("mint refused a ttl");
  const row = { digest: m.value.digest };
  expect(isOk(tokens(ctx).check(m.value.token, () => row))).toBe(true);
  await ctx.clock.advance(TTL);
  expect(errorOf(tokens(ctx).check(m.value.token, () => row)).code).toBe("credentials.expired");
});
