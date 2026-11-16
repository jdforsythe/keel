// Spec: std.credentials, Stored form "`$scrypt$ln=<ln>,r=8,p=1$<salt>$<key>`: `scrypt` (`node:crypto`) with N = 2^`ln`, a 16-byte salt and a 32-byte key in base64 without padding."
// Spec: std.credentials, Stored form "`verify` reads `scrypt` with `ln` 14 to 20, `r` 8, `p` 1 to 5, a salt of 8 to 64 bytes and a key of 16 to 64."
// Spec: std.credentials, Conformance "Under real, a `hash` with one salt or key character changed is `credentials.mismatch`; `ln=30` and id `argon2id` are `credentials.malformed` `parameters`, and `hunter2` is `format`."
// Spec: std.credentials, Conformance "`$scrypt$ln=14,r=8,p=1$` with a salt and that secret's `scryptSync` key verifies, `rehash` true."
// Spec: std.credentials, Modes "**shell.** As real."
// Spec: std.credentials, API "`Hashed` (`credentials.Hashed`) is a format type over `s.string()`: `$id$params$salt$key`, `$v=<n>` allowed after the id, at most 256 characters."
// Seed: 1337.
// Assumption: a string of the `Hashed` shape whose `ln`, `r`, `p`, salt or key size is outside the ranges `verify` reads is `credentials.malformed` `parameters` (the spec lists them as the parameters read).
// Assumption: the `hunter2` stored string reaches `verify` through `rawVerify`, since the types refuse it.
// Assumption: base64 characters at the last salt and key position carry padding bits only, so the characters changed are not the last.
import { randomBytes, scryptSync } from "node:crypto";
import { Hashed } from "@keel/std-credentials";
import { credentials } from "@keel/std-credentials/server";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, b64, errorOf, hashedOf, isOk, rawVerify, realCtx, rehashOf, secretOf, shellCtx } from "./fixtures.ts";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const PASSWORD = "correct horse battery staple";
const bytesOf = (text: string): Buffer => Buffer.from(text.normalize("NFKC"), "utf8");
const formOf = (ln: number, r: number, p: number, salt: Uint8Array, key: Uint8Array, id = "scrypt"): string =>
  `$${id}$ln=${ln},r=${r},p=${p}$${b64(salt)}$${b64(key)}`;
const derive = (text: string, salt: Uint8Array, len: number, ln: number, p = 1): Buffer =>
  scryptSync(bytesOf(text), salt, len, { N: 2 ** ln, r: 8, p, maxmem: 256 * 1024 * 1024 });

const real = realCtx();
let storedCache: string | undefined;
async function stored(): Promise<string> {
  if (storedCache !== undefined) return storedCache;
  const h = await credentials(real).hash(secretOf(PASSWORD));
  if (!h.ok) throw new Error("hash refused a secret");
  storedCache = h.value;
  return h.value;
}
const parts = (text: string): { id: string; params: string; salt: string; key: string } => {
  const [, id = "", params = "", salt = "", key = ""] = text.split("$");
  return { id, params, salt, key };
};
const swap = (text: string, at: number, ch: string): string => text.slice(0, at) + ch + text.slice(at + 1);
const differentChar = (old: string, pick: number): string => {
  const c = ALPHABET[pick % ALPHABET.length] ?? "A";
  return c === old ? (ALPHABET[(pick + 1) % ALPHABET.length] ?? "B") : c;
};

test("The RFC 7914 vector anchors the `scryptSync` the tests build strings with.", () => {
  const out = scryptSync("password", "NaCl", 64, { N: 1024, r: 8, p: 16 }).toString("hex");
  expect(out.startsWith("fdbabe1c9d347200")).toBe(true);
});

test("Under real, a `hash` with one salt or key character changed is `credentials.mismatch`; `ln=30` and id `argon2id` are `credentials.malformed` `parameters`, and `hunter2` is `format`. (salt or key character)", async () => {
  const h = await stored();
  const { salt, key } = parts(h);
  const saltAt = h.indexOf(salt);
  const keyAt = h.lastIndexOf(key);
  await fc.assert(
    fc.asyncProperty(
      fc.boolean(),
      fc.integer({ min: 0, max: 20 }),
      fc.integer({ min: 0, max: 41 }),
      fc.integer({ min: 0, max: 63 }),
      async (inSalt, saltIdx, keyIdx, pick) => {
        const at = inSalt ? saltAt + saltIdx : keyAt + keyIdx;
        const changed = swap(h, at, differentChar(h.charAt(at), pick));
        const r = await credentials(real).verify(secretOf(PASSWORD), hashedOf(changed));
        expect(errorOf(r).code).toBe("credentials.mismatch");
      },
    ),
    { seed: SEED, numRuns: 5 },
  );
}, 120_000);

test("Under real, a `hash` with one salt or key character changed is `credentials.mismatch`; `ln=30` and id `argon2id` are `credentials.malformed` `parameters`, and `hunter2` is `format`. (parameters and format)", async () => {
  const h = await stored();
  const cases: [string, string][] = [
    ["ln=30", h.replace("ln=17", "ln=30")],
    ["id argon2id", h.replace("$scrypt$", "$argon2id$")],
    ["hunter2", "hunter2"],
  ];
  for (const [label, text] of cases) {
    const e = errorOf(await rawVerify(real, secretOf(PASSWORD), text));
    expect(e.code, label).toBe("credentials.malformed");
    expect(e.data, label).toEqual({ reason: label === "hunter2" ? "format" : "parameters" });
  }
}, 120_000);

test("Under real, a `hash` with one salt or key character changed is `credentials.mismatch`; `ln=30` and id `argon2id` are `credentials.malformed` `parameters`, and `hunter2` is `format`. (nothing throws or rejects)", async () => {
  const h = await stored();
  const refused: string[] = [
    "hunter2",
    "",
    "$",
    "$$$$",
    h.replace("ln=17", "ln=30"),
    h.replace("$scrypt$", "$argon2id$"),
    h.replace("p=1", "p=x"),
  ];
  for (const text of refused) {
    const r = await rawVerify(real, secretOf(PASSWORD), text);
    expect(isOk(r)).toBe(false);
    expect(errorOf(r).code).toBe("credentials.malformed");
  }
}, 120_000);

test("`$scrypt$ln=14,r=8,p=1$` with a salt and that secret's `scryptSync` key verifies, `rehash` true.", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 30 }),
      fc.uint8Array({ minLength: 16, maxLength: 16 }),
      async (text, salt) => {
        const built = formOf(14, 8, 1, salt, derive(text, salt, 32, 14));
        const r = await credentials(real).verify(secretOf(text), hashedOf(built));
        expect(isOk(r)).toBe(true);
        expect(rehashOf(r)).toBe(true);
        const wrong = await credentials(real).verify(secretOf(`${text}x`), hashedOf(built));
        expect(errorOf(wrong).code).toBe("credentials.mismatch");
      },
    ),
    { seed: SEED, numRuns: 10 },
  );
}, 120_000);

test("`verify` reads `scrypt` with `ln` 14 to 20, `r` 8, `p` 1 to 5, a salt of 8 to 64 bytes and a key of 16 to 64. (read)", async () => {
  // Salt and key bytes come from `randomBytes`: the strings are built in the test and only their verification is asserted.
  const salt = Uint8Array.from(randomBytes(16));
  for (const p of [1, 5]) {
    const r = await credentials(real).verify(
      secretOf(PASSWORD),
      hashedOf(formOf(14, 8, p, salt, derive(PASSWORD, salt, 32, 14, p))),
    );
    expect(isOk(r), `p=${p}`).toBe(true);
  }
  const sizes: [number, number][] = [
    [8, 32],
    [64, 32],
    [16, 16],
    [16, 64],
  ];
  for (const [saltLen, keyLen] of sizes) {
    const sl = Uint8Array.from(randomBytes(saltLen));
    const r = await credentials(real).verify(
      secretOf(PASSWORD),
      hashedOf(formOf(14, 8, 1, sl, derive(PASSWORD, sl, keyLen, 14))),
    );
    expect(isOk(r), `salt ${saltLen} key ${keyLen}`).toBe(true);
    expect(rehashOf(r)).toBe(true);
  }
}, 120_000);

test("`verify` reads `scrypt` with `ln` 14 to 20, `r` 8, `p` 1 to 5, a salt of 8 to 64 bytes and a key of 16 to 64. (refused)", async () => {
  const salt = Uint8Array.from(randomBytes(16));
  const key = Uint8Array.from(derive(PASSWORD, salt, 32, 14));
  const refused: string[] = [
    formOf(13, 8, 1, salt, key),
    formOf(21, 8, 1, salt, key),
    formOf(14, 7, 1, salt, key),
    formOf(14, 9, 1, salt, key),
    formOf(14, 8, 0, salt, key),
    formOf(14, 8, 6, salt, key),
    formOf(14, 8, 1, salt.slice(0, 7), key),
    formOf(14, 8, 1, new Uint8Array(65), key),
    formOf(14, 8, 1, salt, key.slice(0, 15)),
    formOf(14, 8, 1, salt, new Uint8Array(65)),
  ];
  for (const text of refused) {
    const e = errorOf(await credentials(real).verify(secretOf(PASSWORD), hashedOf(text)));
    expect(e.code, text).toBe("credentials.malformed");
    expect(e.data, text).toEqual({ reason: "parameters" });
  }
}, 120_000);

test("**shell.** As real.", async () => {
  const shell = shellCtx();
  const h = await credentials(shell).hash(secretOf(PASSWORD));
  if (!h.ok) throw new Error("hash refused a secret");
  expect(h.value).toMatch(/^\$scrypt\$ln=17,r=8,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
  const r = await credentials(real).verify(secretOf(PASSWORD), hashedOf(h.value));
  expect(rehashOf(r)).toBe(false);
  const back = await credentials(shell).verify(secretOf(PASSWORD), hashedOf(await stored()));
  expect(isOk(back)).toBe(true);
  expect(errorOf(await rawVerify(shell, secretOf(PASSWORD), "hunter2")).data).toEqual({ reason: "format" });
}, 120_000);

test("`Hashed` (`credentials.Hashed`) is a format type over `s.string()`: `$id$params$salt$key`, `$v=<n>` allowed after the id, at most 256 characters.", async () => {
  const h = await stored();
  const { id, params, salt, key } = parts(h);
  const versioned = `$${id}$v=2$${params}$${salt}$${key}`;
  expect(Hashed.parse(versioned).ok).toBe(true);
  const head = `$${id}$${params}$${salt}$`;
  expect(Hashed.parse(`${head}${"A".repeat(256 - head.length)}`).ok).toBe(true);
  expect(Hashed.parse(`${head}${"A".repeat(257 - head.length)}`).ok).toBe(false);
  expect(Hashed.parse("hunter2").ok).toBe(false);
}, 120_000);
