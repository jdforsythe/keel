// Spec: std.tokens, API "`mint({ ttl })`: `ttl` is required, milliseconds as an integer from 60,000 to 31,536,000,000 (365 days), or `null` for a token that does not expire; any other value is `credentials.ttl` (data `{ min: 60000, max: 31536000000 }`)."
// Spec: std.tokens, API "It returns the new `token` as a `Secret<string>`, its `id` (the token's non-secret part, the row's lookup key), the `digest` to store, and `expiresAt`, `ctx.clock.now()` plus `ttl`, or `null`."
// Spec: std.tokens, Forms "Token: `keel_<id>_<secret>`, `id` 16 and `secret` 64 lowercase hex characters (64 and 256 random bits), 86 characters."
// Spec: std.tokens, Forms "Digest: `$sha256$exp=<ms>$<digest>`, or `$sha256$<digest>` with no expiry: `<ms>` is `expiresAt` in decimal, `<digest>` the SHA-256 of the token's text in base64 without padding."
// Spec: std.tokens, Conformance "Under real, `mint({ ttl: null })` gives a token of the token form whose id part is `id`, `expiresAt` `null`, and a `digest` `$sha256$<digest>` that parses with `Digested`; two mints share no `id`, `secret` or `digest`."
// Spec: std.tokens, Conformance "`mint({ ttl })` for `ttl` 60,000 and 31,536,000,000 is `ok` with `expiresAt` `ctx.clock.now()` plus `ttl` and `exp=<expiresAt>` in `digest`; 59,999, 31,536,000,001, 60,000.5 and `NaN` are `credentials.ttl`."
// Spec: std.tokens, Conformance "`String`, `JSON.stringify` and `util.inspect` of a minted `token` give `[secret]`."
// Seed: 1337.
// Assumption: "ttl is required" is a type-level rule and is not tested; `Infinity` is refused like `NaN` (not an integer in range).
// Assumption: the 100 mints for "share no `id`, `secret` or `digest`" are made on one real ctx.
import { createHash } from "node:crypto";
import { inspect } from "node:util";
import { reveal } from "@keel/schema";
import { tokens } from "@keel/std-tokens/server";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, digestedOf, errorOf, isOk, realCtx, simCtx } from "./fixtures.ts";

const MIN = 60_000;
const MAX = 31_536_000_000;
const b64sha = (text: string): string => createHash("sha256").update(text).digest("base64").replace(/=+$/, "");
const mintOk = (ctx: Parameters<typeof tokens>[0], ttl: number | null) => {
  const m = tokens(ctx).mint({ ttl });
  if (!m.ok) throw new Error("mint refused a ttl");
  return m.value;
};

test("Under real, `mint({ ttl: null })` gives a token of the token form whose id part is `id`, `expiresAt` `null`, and a `digest` `$sha256$<digest>` that parses with `Digested`; two mints share no `id`, `secret` or `digest`.", () => {
  const ctx = realCtx();
  const v = mintOk(ctx, null);
  const text = reveal(v.token);
  expect(text).toMatch(/^keel_[0-9a-f]{16}_[0-9a-f]{64}$/);
  expect(text).toHaveLength(86);
  expect(text.split("_")[1]).toBe(v.id);
  expect(v.expiresAt).toBeNull();
  expect(v.digest).toMatch(/^\$sha256\$[A-Za-z0-9+/]{43}$/);
  expect(digestedOf(v.digest)).toBe(v.digest);
  expect(v.digest).toBe(`$sha256$${b64sha(text)}`);
  const ids = new Set<string>();
  const secrets = new Set<string>();
  const digests = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const m = mintOk(ctx, null);
    const [, id = "", secret = ""] = reveal(m.token).split("_");
    ids.add(id);
    secrets.add(secret);
    digests.add(m.digest);
  }
  expect(ids.size).toBe(100);
  expect(secrets.size).toBe(100);
  expect(digests.size).toBe(100);
});

test("`mint({ ttl })` for `ttl` 60,000 and 31,536,000,000 is `ok` with `expiresAt` `ctx.clock.now()` plus `ttl` and `exp=<expiresAt>` in `digest`; 59,999, 31,536,000,001, 60,000.5 and `NaN` are `credentials.ttl`. (bounds)", () => {
  for (const ttl of [MIN, MAX]) {
    const ctx = simCtx();
    expect(ctx.clock.now()).toBe(0);
    const v = mintOk(ctx, ttl);
    expect(v.expiresAt).toBe(ttl);
    expect(v.digest.startsWith("$sha256-sim$")).toBe(true);
    expect(v.digest).toContain(`exp=${v.expiresAt}`);
    expect(digestedOf(v.digest)).toBe(v.digest);
  }
  for (const ttl of [MIN, MAX]) {
    const ctx = realCtx();
    const before = ctx.clock.now();
    const v = mintOk(ctx, ttl);
    const after = ctx.clock.now();
    const at = v.expiresAt;
    if (at === null) throw new Error("expiresAt is null");
    expect(at).toBeGreaterThanOrEqual(before + ttl);
    expect(at).toBeLessThanOrEqual(after + ttl);
    expect(v.digest).toMatch(new RegExp(`^\\$sha256\\$exp=${at}\\$[A-Za-z0-9+/]{43}$`));
  }
});

test("`mint({ ttl })` for `ttl` 60,000 and 31,536,000,000 is `ok` with `expiresAt` `ctx.clock.now()` plus `ttl` and `exp=<expiresAt>` in `digest`; 59,999, 31,536,000,001, 60,000.5 and `NaN` are `credentials.ttl`. (any ttl in range, any clock)", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: MIN, max: MAX }), fc.integer({ min: 0, max: 10 ** 9 }), async (ttl, at) => {
      const ctx = simCtx();
      await ctx.clock.advance(at);
      const v = mintOk(ctx, ttl);
      expect(v.expiresAt).toBe(ctx.clock.now() + ttl);
      expect(v.digest).toContain(`exp=${ctx.clock.now() + ttl}`);
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("`mint({ ttl })` for `ttl` 60,000 and 31,536,000,000 is `ok` with `expiresAt` `ctx.clock.now()` plus `ttl` and `exp=<expiresAt>` in `digest`; 59,999, 31,536,000,001, 60,000.5 and `NaN` are `credentials.ttl`. (refused)", () => {
  const refused = [MIN - 1, MAX + 1, 60_000.5, Number.NaN, Number.POSITIVE_INFINITY];
  for (const ctx of [simCtx(), realCtx()]) {
    for (const ttl of refused) {
      const r = tokens(ctx).mint({ ttl });
      expect(isOk(r), `${ttl}`).toBe(false);
      expect(errorOf(r).code, `${ttl}`).toBe("credentials.ttl");
      expect(errorOf(r).data, `${ttl}`).toEqual({ min: MIN, max: MAX });
    }
  }
  fc.assert(
    fc.property(
      fc.oneof(
        fc.integer({ min: -(2 ** 40), max: MIN - 1 }),
        fc.integer({ min: MAX + 1, max: 2 ** 50 }),
        fc.integer({ min: MIN, max: MAX - 1 }).map((n) => n + 0.5),
      ),
      (ttl) => {
        const r = tokens(simCtx()).mint({ ttl });
        expect(errorOf(r).code).toBe("credentials.ttl");
        expect(errorOf(r).data).toEqual({ min: MIN, max: MAX });
      },
    ),
    { seed: SEED, numRuns: 100 },
  );
});

test("`String`, `JSON.stringify` and `util.inspect` of a minted `token` give `[secret]`.", () => {
  for (const ctx of [realCtx(), simCtx()]) {
    const { token } = mintOk(ctx, null);
    expect(String(token)).toBe("[secret]");
    expect(JSON.stringify(token)).toBe('"[secret]"');
    expect(inspect(token)).toBe("[secret]");
    expect(JSON.stringify({ token })).toBe('{"token":"[secret]"}');
  }
});
