// Spec: std.credentials, API "Each error is one constant per code, `reason` and `limit`: none holds a part of the secret or of `stored`, and no call throws."
// Spec: std.credentials, Conformance "Every `err` above deep-equals the one of its code and `reason` for another secret and `stored`."
// Seed: 1337.
// Assumption: the generated secrets are 12 to 30 lowercase letters and digits with a `s-` prefix and the stored strings carry a distinct salt, so a substring check on the JSON of an error is unambiguous.
// Assumption: `credentials.length` has one constant per code (its `limit` is the same `{ min, max }` always); `credentials.mismatch` one; `credentials.malformed` one per `reason`.
import { credentials } from "@keel/std-credentials/server";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, errorOf, hashedOf, isOk, rawVerify, realCtx, secretOf, simCtx } from "./fixtures.ts";

const word = fc.stringMatching(/^s-[a-z0-9]{12,30}$/);
const salts = fc.stringMatching(/^[A-Za-z0-9]{21}A$/);
const keys = fc.stringMatching(/^[A-Za-z0-9]{42}A$/);
const stored = (salt: string, key: string, ln = 17, id = "scrypt"): string => `$${id}$ln=${ln},r=8,p=1$${salt}$${key}`;
const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

async function hashText(ctx: Parameters<typeof credentials>[0], text: string): Promise<string> {
  const h = await credentials(ctx).hash(secretOf(text));
  if (!h.ok) throw new Error("hash refused a secret");
  return h.value;
}

function expectClean(err: unknown, secrets: string[], storeds: string[]): void {
  const json = JSON.stringify(err);
  for (const s of [...secrets, ...storeds]) expect(json).not.toContain(s);
  for (const stored of storeds)
    for (const part of stored.split("$").filter((p) => p.length >= 16)) expect(json).not.toContain(part);
}

test("Every `err` above deep-equals the one of its code and `reason` for another secret and `stored`. (credentials.length)", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1025, max: 1500 }),
      fc.integer({ min: 1025, max: 1500 }),
      word,
      async (n, m, w) => {
        const ctx = simCtx();
        const a = errorOf(await credentials(ctx).hash(secretOf(`${w}${"x".repeat(n)}`)));
        const b = errorOf(await credentials(ctx).hash(secretOf(`${"y".repeat(m)}${w}`)));
        const c = errorOf(await credentials(ctx).hash(secretOf("")));
        expect(a.code).toBe("credentials.length");
        expect(a.error).toEqual(b.error);
        expect(a.error).toEqual(c.error);
        expect(sameJson(a.error, b.error)).toBe(true);
        expectClean(a.error, [w, "x".repeat(40)], []);
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

test("Every `err` above deep-equals the one of its code and `reason` for another secret and `stored`. (credentials.mismatch)", async () => {
  await fc.assert(
    fc.asyncProperty(word, word, word, word, async (x, y, z, w) => {
      fc.pre(new Set([x, y, z, w]).size === 4);
      const ctx = simCtx();
      const hx = hashedOf(await hashText(ctx, x));
      const hz = hashedOf(await hashText(ctx, z));
      const wrongA = errorOf(await credentials(ctx).verify(secretOf(y), hx));
      const wrongB = errorOf(await credentials(ctx).verify(secretOf(w), hz));
      const none = errorOf(await credentials(ctx).verify(secretOf(y), undefined));
      const empty = errorOf(await credentials(ctx).verify(secretOf(""), hx));
      expect(wrongA.code).toBe("credentials.mismatch");
      expect(wrongA.error).toEqual(wrongB.error);
      expect(wrongA.error).toEqual(none.error);
      expect(wrongA.error).toEqual(empty.error);
      expectClean(wrongA.error, [x, y, z, w], [hx, hz]);
      expectClean(wrongB.error, [x, y, z, w], [hx, hz]);
    }),
    { seed: SEED, numRuns: 50 },
  );
});

test("Every `err` above deep-equals the one of its code and `reason` for another secret and `stored`. (credentials.mismatch under real)", async () => {
  const ctx = realCtx();
  const hx = hashedOf(await hashText(ctx, "s-first-secret-1"));
  const hz = hashedOf(await hashText(ctx, "s-third-secret-3"));
  const a = errorOf(await credentials(ctx).verify(secretOf("s-second-secret-2"), hx));
  const b = errorOf(await credentials(ctx).verify(secretOf("s-fourth-secret-4"), hz));
  const c = errorOf(await credentials(ctx).verify(secretOf("s-fifth-secret-5"), undefined));
  expect(a.code).toBe("credentials.mismatch");
  expect(a.error).toEqual(b.error);
  expect(a.error).toEqual(c.error);
  expectClean(a.error, ["s-first-secret-1", "s-second-secret-2", "s-third-secret-3", "s-fourth-secret-4"], [hx, hz]);
}, 120_000);

test("Every `err` above deep-equals the one of its code and `reason` for another secret and `stored`. (credentials.malformed, each reason)", async () => {
  await fc.assert(
    fc.asyncProperty(word, word, salts, keys, salts, keys, async (x, y, saltA, keyA, saltB, keyB) => {
      fc.pre(x !== y);
      const ctx = realCtx();
      const simA = hashedOf(await hashText(simCtx(1), x));
      const simB = hashedOf(await hashText(simCtx(2), y));
      const byReason: [string, string, string][] = [
        ["format", `plain-${saltA}`, `other-${saltB}`],
        ["parameters", stored(saltA, keyA, 30), stored(saltB, keyB, 31, "argon2id")],
        ["sim", simA, simB],
      ];
      for (const [reason, a, b] of byReason) {
        const ea = errorOf(await rawVerify(ctx, secretOf(x), a));
        const eb = errorOf(await rawVerify(ctx, secretOf(y), b));
        expect(ea.code, reason).toBe("credentials.malformed");
        expect(ea.data, reason).toEqual({ reason });
        expect(ea.error, reason).toEqual(eb.error);
        expectClean(ea.error, [x, y], [a, b]);
        expectClean(eb.error, [x, y], [a, b]);
      }
    }),
    { seed: SEED, numRuns: 30 },
  );
}, 120_000);

test("Each error is one constant per code, `reason` and `limit`: none holds a part of the secret or of `stored`, and no call throws.", async () => {
  const ctx = simCtx();
  const stored1 = hashedOf(await hashText(ctx, "s-abc-123-secret"));
  const calls: Promise<unknown>[] = [
    credentials(ctx).hash(secretOf("")),
    credentials(ctx).verify(secretOf("s-other-secret-9"), stored1),
    credentials(ctx).verify(secretOf("s-other-secret-9"), undefined),
    rawVerify(ctx, secretOf("s-other-secret-9"), "hunter2"),
  ];
  for (const call of calls) {
    const r = await call;
    expect(isOk(r)).toBe(false);
    expectClean(errorOf(r).error, ["s-other-secret-9", "s-abc-123-secret"], [stored1]);
  }
});
