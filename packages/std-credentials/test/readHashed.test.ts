// Seed 1337. The stored-form reader: parts round-trip inside the read ranges; a non-`Hashed` text is `format`; each
// bound is read and the value one past it is `parameters`.
import { Hashed } from "@keel/std-credentials";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { readHashed } from "../src/server/internal/readHashed.ts";

const SEED = 1337;
const b64 = (b: Uint8Array): string => Buffer.from(b).toString("base64").replaceAll("=", "");
const text = (id: string, ln: number, r: number, p: number, salt: number, key: number): string =>
  `$${id}$ln=${ln},r=${r},p=${p}$${b64(new Uint8Array(salt).fill(7))}$${b64(new Uint8Array(key).fill(9))}`;

describe("readHashed", () => {
  test("parts round-trip for generated parameters, salt and key inside the read ranges", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("scrypt", "scrypt-sim"),
        fc.integer({ min: 14, max: 20 }),
        fc.integer({ min: 1, max: 5 }),
        fc.uint8Array({ minLength: 8, maxLength: 64 }),
        fc.uint8Array({ minLength: 16, maxLength: 64 }),
        (id, ln, p, salt, key) => {
          const parts = readHashed(`$${id}$ln=${ln},r=8,p=${p}$${b64(salt)}$${b64(key)}`);
          expect(parts).not.toBe("format");
          expect(parts).not.toBe("parameters");
          if (typeof parts === "string") return;
          expect(parts.id).toBe(id);
          expect([parts.ln, parts.r, parts.p]).toEqual([ln, 8, p]);
          expect(new Uint8Array(parts.salt)).toEqual(salt);
          expect(new Uint8Array(parts.key)).toEqual(key);
          expect(parts.exact).toBe(true);
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });

  test("any text `Hashed` refuses is `format`", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (v) => {
        fc.pre(!Hashed.parse(v).ok);
        expect(readHashed(v)).toBe("format");
      }),
      { seed: SEED, numRuns: 300 },
    );
    expect(readHashed("hunter2")).toBe("format");
    expect(readHashed(undefined)).toBe("format");
    expect(readHashed(null)).toBe("format");
  });

  test.each([
    ["ln", text("scrypt", 14, 8, 1, 16, 32), text("scrypt", 13, 8, 1, 16, 32)],
    ["ln", text("scrypt", 20, 8, 1, 16, 32), text("scrypt", 21, 8, 1, 16, 32)],
    ["r", text("scrypt", 17, 8, 1, 16, 32), text("scrypt", 17, 7, 1, 16, 32)],
    ["r", text("scrypt", 17, 8, 1, 16, 32), text("scrypt", 17, 9, 1, 16, 32)],
    ["p", text("scrypt", 17, 8, 1, 16, 32), text("scrypt", 17, 8, 0, 16, 32)],
    ["p", text("scrypt", 17, 8, 5, 16, 32), text("scrypt", 17, 8, 6, 16, 32)],
    ["salt", text("scrypt", 17, 8, 1, 8, 32), text("scrypt", 17, 8, 1, 7, 32)],
    ["salt", text("scrypt", 17, 8, 1, 64, 32), text("scrypt", 17, 8, 1, 65, 32)],
    ["key", text("scrypt", 17, 8, 1, 16, 16), text("scrypt", 17, 8, 1, 16, 15)],
    ["key", text("scrypt", 17, 8, 1, 16, 64), text("scrypt", 17, 8, 1, 16, 65)],
  ])("%s: the bound is read, one past it is `parameters`", (_, at, past) => {
    expect(Hashed.parse(at).ok).toBe(true);
    expect(Hashed.parse(past).ok).toBe(true);
    expect(typeof readHashed(at)).toBe("object");
    expect(readHashed(past)).toBe("parameters");
  });

  test("another id, a version mark and a parameter written another way are `parameters`", () => {
    const tail = `$${b64(new Uint8Array(16))}$${b64(new Uint8Array(32))}`;
    expect(readHashed(`$argon2id$ln=17,r=8,p=1${tail}`)).toBe("parameters");
    expect(readHashed(`$scrypt$v=1$ln=17,r=8,p=1${tail}`)).toBe("parameters");
    expect(readHashed(`$scrypt$ln=017,r=8,p=1${tail}`)).toBe("parameters");
    expect(readHashed(`$scrypt$r=8,ln=17,p=1${tail}`)).toBe("parameters");
    expect(readHashed(`$scrypt$ln=30,r=8,p=1${tail}`)).toBe("parameters");
  });

  test("a salt or key text that is not the canonical encoding of its bytes reads with `exact` false", () => {
    const parts = readHashed(`$scrypt$ln=17,r=8,p=1$${"A".repeat(21)}B$${"A".repeat(43)}`);
    expect(typeof parts === "object" && parts.exact).toBe(false);
  });
});
