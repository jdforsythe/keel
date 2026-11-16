// Seed 1337. `verify` under sim: one character replaced in a hash never verifies; a secret verifies in its NFC, NFD and
// NFKD forms.
import { createCtx } from "@keel/ctx";
import { type Secret, s } from "@keel/schema";
import { Hashed } from "@keel/std-credentials";
import { credentials } from "@keel/std-credentials/server";
import fc from "fast-check";
import { expect, test } from "vitest";

const SEED = 1337;
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const SecretText = s.secret(s.string());
const secretOf = (text: string): Secret<string> => {
  const r = SecretText.parse(text);
  if (!r.ok) throw new Error("not a secret");
  return r.value;
};
const bytes = (v: string): number => Buffer.byteLength(v.normalize("NFKC"), "utf8");

test("a sim hash with any one character replaced never verifies", async () => {
  const c = credentials(createCtx({ mode: "sim", seed: SEED }));
  const secret = secretOf("correct horse battery staple");
  const h = await c.hash(secret);
  if (!h.ok) throw new Error("hash failed");
  const stored: string = h.value;
  await fc.assert(
    fc.asyncProperty(fc.nat({ max: stored.length - 1 }), fc.constantFrom(...`${B64}$=,-az09`), async (at, ch) => {
      fc.pre(stored.charAt(at) !== ch);
      const changed = `${stored.slice(0, at)}${ch}${stored.slice(at + 1)}`;
      const parsed = Hashed.parse(changed);
      if (!parsed.ok) return;
      const r = await c.verify(secret, parsed.value);
      expect(r.ok).toBe(false);
    }),
    { seed: SEED, numRuns: 300 },
  );
});

test("a secret verifies against its hash in its NFC, NFD and NFKD forms", async () => {
  const c = credentials(createCtx({ mode: "sim", seed: SEED }));
  await fc.assert(
    fc.asyncProperty(fc.fullUnicodeString({ minLength: 1, maxLength: 24 }), async (v) => {
      fc.pre(bytes(v) >= 1 && bytes(v) <= 1024);
      const h = await c.hash(secretOf(v));
      if (!h.ok) throw new Error("hash failed");
      for (const form of ["NFC", "NFD", "NFKD", "NFKC"]) {
        const r = await c.verify(secretOf(v.normalize(form)), h.value);
        expect(r).toEqual({ ok: true, value: { rehash: false } });
      }
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("U+212B and U+00C5 are one password", async () => {
  const c = credentials(createCtx({ mode: "sim", seed: SEED }));
  const h = await c.hash(secretOf("passÅword"));
  if (!h.ok) throw new Error("hash failed");
  expect((await c.verify(secretOf("passÅword"), h.value)).ok).toBe(true);
});
