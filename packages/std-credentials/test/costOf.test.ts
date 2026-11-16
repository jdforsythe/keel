// Seed 1337. The ctx's cost is the highest `ln` the modules set, 17 for none; `rehash` is true exactly when the stored
// `ln` is below it, the salt under 16 bytes or the key under 32.
import { scryptSync } from "node:crypto";
import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import { type Secret, s } from "@keel/schema";
import { Hashed } from "@keel/std-credentials";
import fc from "fast-check";
import { expect, test } from "vitest";
import { costOf } from "../src/server/internal/costOf.ts";
import { hasherOf } from "../src/server/internal/hasherOf.ts";
import { simEngine } from "../src/server/internal/simEngine.ts";

const SEED = 1337;
const PKG = "@keel/std-credentials";
const SecretText = s.secret(s.string());
const secretOf = (text: string): Secret<string> => {
  const r = SecretText.parse(text);
  if (!r.ok) throw new Error("not a secret");
  return r.value;
};
const b64 = (b: Uint8Array): string => Buffer.from(b).toString("base64").replaceAll("=", "");

const configs = fc.dictionary(
  fc.stringMatching(/^[a-z]{1,8}$/),
  fc.option(fc.integer({ min: 17, max: 20 }), { nil: undefined }).map((ln) => (ln === undefined ? {} : { ln })),
  { maxKeys: 6 },
);

test("the ctx's `ln` is the highest any module sets, 17 when none does", () => {
  fc.assert(
    fc.property(configs, (byModule) => {
      const ctx = createCtx({ mode: "sim", seed: SEED });
      bindStd(ctx, { [PKG]: byModule });
      const set = Object.values(byModule).map((c) => ("ln" in c ? c.ln : 17));
      expect(costOf(ctx)).toBe(Math.max(17, ...set));
    }),
    { seed: SEED, numRuns: 200 },
  );
  expect(costOf(createCtx({ mode: "sim", seed: SEED }))).toBe(17);
});

test("`rehash` is true exactly when the stored ln, salt or key is below the ctx's cost", async () => {
  const input = "a password of some length";
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 17, max: 20 }),
      fc.integer({ min: 14, max: 20 }),
      fc.integer({ min: 8, max: 32 }),
      fc.integer({ min: 16, max: 48 }),
      async (ln, storedLn, saltLen, keyLen) => {
        const salt = new Uint8Array(saltLen).fill(3);
        const key = scryptSync(Buffer.from(input), salt, keyLen, { N: 16, r: 8, p: 1 });
        const stored = Hashed.parse(`$scrypt-sim$ln=${storedLn},r=8,p=1$${b64(salt)}$${b64(key)}`);
        if (!stored.ok) throw new Error("not a Hashed");
        const r = await hasherOf(ln, simEngine(SEED), () => 0).verify(secretOf(input), stored.value);
        expect(r).toEqual({ ok: true, value: { rehash: storedLn < ln || saltLen < 16 || keyLen < 32 } });
      },
    ),
    { seed: SEED, numRuns: 150 },
  );
});
