// Seed 1337. `check` under sim: a token with one character replaced, and any generated string, never matches the
// minted row; `expired` exactly when `now >= expiresAt`; the clock is read only after a match.
import { type Secret, reveal, s } from "@keel/schema";
import { Digested } from "@keel/std-credentials";
import fc from "fast-check";
import { expect, test } from "vitest";
import { hasherOf } from "../src/server/internal/hasherOf.ts";
import { simEngine } from "../src/server/internal/simEngine.ts";

const SEED = 1337;
const SecretText = s.secret(s.string());
const secretOf = (text: string): Secret<string> => {
  const r = SecretText.parse(text);
  if (!r.ok) throw new Error("not a secret");
  return r.value;
};

const minted = (now: () => number, ttl: number | null) => {
  const c = hasherOf(17, simEngine(SEED), now);
  const m = c.mint({ ttl });
  if (!m.ok) throw new Error("mint failed");
  const row = { id: m.value.id, digest: m.value.digest };
  return { c, m: m.value, row, find: (id: string) => (id === row.id ? row : undefined) };
};

test("a sim token with any one character replaced never matches its row", () => {
  const { c, m, find } = minted(() => 0, null);
  const text = reveal(m.token);
  fc.assert(
    fc.property(fc.nat({ max: text.length - 1 }), fc.constantFrom(..."0123456789abcdefgkls_Z"), (at, ch) => {
      fc.pre(text.charAt(at) !== ch);
      const r = c.check(secretOf(`${text.slice(0, at)}${ch}${text.slice(at + 1)}`), find);
      expect(r.ok).toBe(false);
    }),
    { seed: SEED, numRuns: 300 },
  );
});

test("any generated string never matches the minted row", () => {
  const { c, m, row } = minted(() => 0, null);
  const text = reveal(m.token);
  fc.assert(
    fc.property(fc.oneof(fc.string(), fc.stringMatching(/^keelsim_[0-9a-f]{16}_[0-9a-f]{64}$/)), (v) => {
      fc.pre(v !== text);
      expect(c.check(secretOf(v), () => row).ok).toBe(false);
    }),
    { seed: SEED, numRuns: 300 },
  );
});

test("`expired` exactly when now >= expiresAt", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 1e12 }),
      fc.integer({ min: 60000, max: 31536000000 }),
      fc.integer({ min: 0, max: 4e10 }),
      (start, ttl, later) => {
        let clock = start;
        const { c, m, find } = minted(() => clock, ttl);
        expect(m.expiresAt).toBe(start + ttl);
        clock = start + later;
        const r = c.check(m.token, find);
        if (clock >= start + ttl) expect(r.ok === false && r.error.code).toBe("credentials.expired");
        else expect(r.ok).toBe(true);
      },
    ),
    { seed: SEED, numRuns: 300 },
  );
});

test("the clock is read only after a match", () => {
  let reads = 0;
  const { c, m, row, find } = minted(() => {
    reads++;
    return 0;
  }, 60000);
  reads = 0;
  const text = reveal(m.token);
  const wrong = `${text.slice(0, -1)}${text.endsWith("0") ? "1" : "0"}`;
  expect(c.check(secretOf(wrong), find)).toMatchObject({ ok: false, error: { code: "credentials.mismatch" } });
  expect(c.check(secretOf("hunter2"), find)).toMatchObject({ ok: false, error: { code: "credentials.mismatch" } });
  expect(c.check(m.token, (): typeof row | undefined => undefined)).toMatchObject({
    ok: false,
    error: { code: "credentials.mismatch" },
  });
  const md5 = Digested.parse(row.digest.replace("sha256-sim", "md5"));
  if (!md5.ok) throw new Error("not a Digested");
  expect(c.check(m.token, () => ({ digest: md5.value }))).toMatchObject({
    ok: false,
    error: { code: "credentials.malformed", data: { reason: "parameters" } },
  });
  expect(reads).toBe(0);
  expect(c.check(m.token, find)).toEqual({ ok: true, value: row });
  expect(reads).toBe(1);
});

test("a find that returns null or a non-object is credentials.mismatch", () => {
  const { c, m } = minted(() => 0, null);
  for (const answer of [null, 0, "row", true]) {
    const raw: unknown = Reflect.apply(c.check, c, [m.token, () => answer]);
    expect(raw).toMatchObject({ ok: false, error: { code: "credentials.mismatch" } });
  }
});
