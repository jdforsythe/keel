// Seed 1337. `mint`'s `ttl` at and around both bounds and off the integers; the digest's `exp` equals `expiresAt`.
import { createCtx } from "@keel/ctx";
import { tokens } from "@keel/std-tokens/server";
import fc from "fast-check";
import { expect, test } from "vitest";
import { simEngine } from "../src/server/internal/simEngine.server.ts";
import { tokensOf } from "../src/server/internal/tokensOf.server.ts";
import { revealed } from "./revealed.server.ts";

const SEED = 1337;
const TTL = { ok: false, error: { code: "credentials.ttl", data: { min: 60000, max: 31536000000 } } };
const at = (now: number) => tokensOf(simEngine(SEED), () => now);

test.each([60000, 60001, 31535999999, 31536000000])("ttl %d is ok", (ttl) => {
  const r = at(5).mint({ ttl });
  expect(r.ok && r.value.expiresAt).toBe(5 + ttl);
});

test.each([59999, 31536000001, 0, -60000, 60000.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
  "ttl %d is credentials.ttl",
  (ttl) => {
    expect(at(0).mint({ ttl })).toMatchObject(TTL);
  },
);

test("non-integers in the range are credentials.ttl, and the answer is one constant", () => {
  const first = at(0).mint({ ttl: 1.5 });
  fc.assert(
    fc.property(fc.double({ min: 60000, max: 31536000000, noNaN: true }), (ttl) => {
      fc.pre(!Number.isInteger(ttl));
      expect(at(0).mint({ ttl })).toBe(first);
    }),
    { seed: SEED, numRuns: 200 },
  );
});

test("the digest's exp equals expiresAt; ttl null writes none", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 1e13 }), fc.integer({ min: 60000, max: 31536000000 }), (now, ttl) => {
      const r = at(now).mint({ ttl });
      if (!r.ok) throw new Error("mint failed");
      expect(r.value.expiresAt).toBe(now + ttl);
      expect(r.value.digest).toMatch(new RegExp(`^\\$sha256-sim\\$exp=${now + ttl}\\$[A-Za-z0-9+/]{43}$`));
      expect(revealed(r.value.token)).toMatch(new RegExp(`^keelsim_${r.value.id}_[0-9a-f]{64}$`));
    }),
    { seed: SEED, numRuns: 200 },
  );
  const r = at(0).mint({ ttl: null });
  expect(r.ok && r.value.expiresAt).toBeNull();
  expect(r.ok && r.value.digest).toMatch(/^\$sha256-sim\$[A-Za-z0-9+/]{43}$/);
});

test("mint with no argument or a non-object is credentials.ttl", () => {
  const c = at(0);
  for (const args of [[], [null], [3600000], ["soon"], [{}]]) {
    const raw: unknown = Reflect.apply(c.mint, c, args);
    expect(raw).toMatchObject(TTL);
  }
});

test("a fractional sim clock still mints with an integer expiresAt", () => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  ctx.clock.advance(0.5);
  const r = tokens(ctx).mint({ ttl: 60000 });
  if (!r.ok) throw new Error("mint failed");
  expect(r.value.expiresAt).toBe(60000);
  expect(r.value.digest).toMatch(/^\$sha256-sim\$exp=60000\$/);
});
