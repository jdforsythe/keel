// Spec: std.credentials, API "`hash` resolves the stored form; an input that is empty or over 1,024 bytes is `credentials.length` (data `{ min: 1, max: 1024 }`)."
// Spec: std.credentials, Conformance "An empty secret and one of 1,025 bytes are `credentials.length` from `hash` and `credentials.mismatch` from `verify`; 1,024 bytes hashes."
// Seed: 1337.
// Assumption: the byte count is of the UTF-8 text after NFKC; the generated secrets are ASCII and U+20AC (three bytes), which NFKC leaves alone.
// Assumption: `verify` of an empty or over-long secret is `credentials.mismatch` whatever `stored` is; it is given a sim `hash` of another secret.
import { credentials } from "@keel/std-credentials/server";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, errorOf, hashedOf, isOk, realCtx, secretOf, simCtx } from "./fixtures.ts";

const LENGTH = { min: 1, max: 1024 };
const bytes = (text: string): number => Buffer.byteLength(text, "utf8");
/** 1,025 bytes of ASCII; 342 three-byte characters (1,026 bytes). */
const OVER: [string, string][] = [
  ["empty", ""],
  ["1,025 ASCII bytes", "a".repeat(1025)],
  ["342 three-byte characters", "€".repeat(342)],
];

async function expectRefused(ctx: Parameters<typeof credentials>[0], label: string, text: string): Promise<void> {
  const c = credentials(ctx);
  const h = await c.hash(secretOf(text));
  expect(isOk(h), label).toBe(false);
  expect(errorOf(h).code, label).toBe("credentials.length");
  expect(errorOf(h).data, label).toEqual(LENGTH);
  const other = await c.hash(secretOf("hunter2"));
  if (!other.ok) throw new Error("hash refused a secret");
  const v = await c.verify(secretOf(text), other.value);
  expect(isOk(v), label).toBe(false);
  expect(errorOf(v).code, label).toBe("credentials.mismatch");
}

test("`hash` resolves the stored form; an input that is empty or over 1,024 bytes is `credentials.length` (data `{ min: 1, max: 1024 }`).", async () => {
  for (const [label, text] of OVER) await expectRefused(simCtx(), label, text);
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1025, max: 4000 }), async (n) => {
      await expectRefused(simCtx(), `${n} bytes`, "a".repeat(n));
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("An empty secret and one of 1,025 bytes are `credentials.length` from `hash` and `credentials.mismatch` from `verify`; 1,024 bytes hashes. (real)", async () => {
  const ctx = realCtx();
  for (const [label, text] of OVER) await expectRefused(ctx, label, text);
  const exact = "a".repeat(1024);
  const h = await credentials(ctx).hash(secretOf(exact));
  expect(isOk(h)).toBe(true);
}, 120_000);

test("An empty secret and one of 1,025 bytes are `credentials.length` from `hash` and `credentials.mismatch` from `verify`; 1,024 bytes hashes. (1,024 bytes)", async () => {
  const exact: [string, string][] = [
    ["1,024 ASCII bytes", "a".repeat(1024)],
    ["341 three-byte characters and one ASCII", `${"€".repeat(341)}a`],
    ["one byte", "a"],
  ];
  for (const [label, text] of exact) {
    expect(bytes(text) <= 1024).toBe(true);
    const ctx = simCtx();
    const h = await credentials(ctx).hash(secretOf(text));
    expect(isOk(h), label).toBe(true);
    if (h.ok) expect(isOk(await credentials(ctx).verify(secretOf(text), hashedOf(h.value))), label).toBe(true);
  }
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 1024 }), async (n) => {
      expect(isOk(await credentials(simCtx()).hash(secretOf("b".repeat(n))))).toBe(true);
    }),
    { seed: SEED, numRuns: 25 },
  );
});
