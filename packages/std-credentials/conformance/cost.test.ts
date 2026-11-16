// Spec: std.credentials, Cost "`std: { '@keel/std-credentials': { ln } }` in a module's manifest: `ln`, log2 of scrypt's N, an integer 17 to 20, default 17; any other value or key is E1158 (k.module)."
// Spec: std.credentials, Cost "A ctx's cost is the highest `ln` any module sets."
// Spec: std.credentials, Cost "`r` is 8 and `p` is 1."
// Spec: std.credentials, Cost "A derivation holds 128 MiB at 17 and twice as much per step."
// Spec: std.credentials, API "`rehash` is true when `stored` is below the ctx's cost: a lower `ln`, a salt under 16 bytes or a key under 32; the caller then stores a new `hash`."
// Spec: std.credentials, Conformance "Under a `createApp` whose `std` sets `ln: 18`, real and sim: `hash` writes `ln=18`, an `ln=17` string verifies with `rehash` true, and under `ln: 17` an `ln=18` string verifies with `rehash` false. `ln: 16` and `ln: 21` are each one E1158 naming `ln`."
// Seed: 1337.
// Assumption: the std config of the package is `{ [moduleId]: { ln } }` in `.keel/std.json`, built by `stdArtifact` from manifests (as packages/server's module-std-config-client test builds one); module id `accounts`.
// Assumption: `check()` imports nothing, so the package's schema and rules register by importing `@keel/std-credentials/server` and `@keel/std-credentials/tools`.
// Assumption: under sim an "`ln=17` string" is a sim-form string of a ctx at 17, and "`ln=18` string" one of a ctx at 18 (the label is the ctx's).
// Untestable: "A derivation holds 128 MiB at 17 and twice as much per step." is a memory figure; the file shows only that `ln` 18 derives (the real cases below).
import { check } from "@keel/check";
import { credentials } from "@keel/std-credentials/server";
import "@keel/std-credentials/tools";
import { randomBytes, scryptSync } from "node:crypto";
import fc from "fast-check";
import { expect, test } from "vitest";
import {
  SEED,
  b64,
  ctxWithCost,
  ctxWithLn,
  errorOf,
  hashedOf,
  isOk,
  realCtx,
  rehashOf,
  secretOf,
  simCtx,
} from "./fixtures.ts";

type Files = Parameters<typeof check>[0];
const secrets = fc.string({ minLength: 1, maxLength: 30 });
const e1158 = (ln: unknown): ReturnType<typeof check>["diagnostics"] => {
  const files: Files = [
    {
      path: "modules/accounts/module.ts",
      source: `import { module } from "@keel/compiler"\nexport default module({ id: "accounts", deps: ["@keel/std-credentials"], capabilities: [], public: { exports: [], routes: [] }, std: { "@keel/std-credentials": ${JSON.stringify(ln)} } })\n`,
    },
  ];
  return check(files, { types: false }).diagnostics.filter((d) => d.code === "E1158");
};

async function hashText(ctx: Parameters<typeof credentials>[0], text: string): Promise<string> {
  const h = await credentials(ctx).hash(secretOf(text));
  if (!h.ok) throw new Error("hash refused a secret");
  return h.value;
}

test("Under a `createApp` whose `std` sets `ln: 18`, sim: `hash` writes `ln=18`, an `ln=17` string verifies with `rehash` true, and under `ln: 17` an `ln=18` string verifies with `rehash` false.", async () => {
  await fc.assert(
    fc.asyncProperty(secrets, async (text) => {
      const at18 = await ctxWithLn(simCtx(), 18);
      const at17 = await ctxWithLn(simCtx(), 17);
      const h18 = await hashText(at18, text);
      expect(h18).toMatch(/^\$scrypt-sim\$ln=18,r=8,p=1\$/);
      const h17 = await hashText(at17, text);
      expect(h17).toMatch(/^\$scrypt-sim\$ln=17,r=8,p=1\$/);
      expect(rehashOf(await credentials(at18).verify(secretOf(text), hashedOf(h17)))).toBe(true);
      expect(rehashOf(await credentials(at17).verify(secretOf(text), hashedOf(h18)))).toBe(false);
      expect(rehashOf(await credentials(at18).verify(secretOf(text), hashedOf(h18)))).toBe(false);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("Under a `createApp` whose `std` sets `ln: 18`, real: `hash` writes `ln=18`, an `ln=17` string verifies with `rehash` true, and under `ln: 17` an `ln=18` string verifies with `rehash` false.", async () => {
  const at18 = await ctxWithLn(realCtx(), 18);
  const at17 = await ctxWithLn(realCtx(), 17);
  const h17 = await hashText(at17, "hunter2");
  expect(h17).toMatch(/^\$scrypt\$ln=17,r=8,p=1\$/);
  expect(rehashOf(await credentials(at18).verify(secretOf("hunter2"), hashedOf(h17)))).toBe(true);
  const h18 = await hashText(at18, "hunter2");
  expect(h18).toMatch(/^\$scrypt\$ln=18,r=8,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
  expect(rehashOf(await credentials(at17).verify(secretOf("hunter2"), hashedOf(h18)))).toBe(false);
}, 120_000);

test("A ctx's cost is the highest `ln` any module sets.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.integer({ min: 17, max: 20 }), { minLength: 1, maxLength: 4 }), async (lns) => {
      const modules: Record<string, unknown> = {};
      lns.forEach((ln, i) => {
        modules[`mod${String.fromCharCode(97 + i)}`] = { ln };
      });
      const ctx = await ctxWithCost(simCtx(), modules);
      const h = await hashText(ctx, "hunter2");
      expect(h).toContain(`ln=${Math.max(...lns)},`);
    }),
    { seed: SEED, numRuns: 30 },
  );
  const ctx = await ctxWithCost(simCtx(), { accounts: { ln: 17 }, billing: { ln: 19 } });
  expect(await hashText(ctx, "hunter2")).toContain("ln=19,");
});

test("`std: { '@keel/std-credentials': { ln } }` in a module's manifest: `ln`, log2 of scrypt's N, an integer 17 to 20, default 17; any other value or key is E1158 (k.module). (default)", async () => {
  const ctx = await ctxWithCost(simCtx(), { accounts: {} });
  expect(await hashText(ctx, "hunter2")).toContain("ln=17,");
  expect(await hashText(simCtx(), "hunter2")).toContain("ln=17,");
});

test("`ln: 16` and `ln: 21` are each one E1158 naming `ln`.", () => {
  for (const ln of [16, 21]) {
    const found = e1158({ ln });
    expect(found, `ln ${ln}`).toHaveLength(1);
    expect(found[0]?.message, `ln ${ln}`).toContain("ln");
  }
});

test("`std: { '@keel/std-credentials': { ln } }` in a module's manifest: `ln`, log2 of scrypt's N, an integer 17 to 20, default 17; any other value or key is E1158 (k.module). (values)", () => {
  for (const ln of [17, 18, 19, 20]) expect(e1158({ ln }), `ln ${ln}`).toHaveLength(0);
  expect(e1158({})).toHaveLength(0);
  fc.assert(
    fc.property(
      fc.oneof(
        fc.integer({ min: -100, max: 16 }),
        fc.integer({ min: 21, max: 100 }),
        fc.constant(17.5),
        fc.constant("18"),
        fc.constant(null),
        fc.constant(true),
      ),
      (ln) => {
        expect(e1158({ ln })).toHaveLength(1);
      },
    ),
    { seed: SEED, numRuns: 50 },
  );
  expect(e1158({ ln: 17, rounds: 3 })).toHaveLength(1);
  expect(e1158({ cost: 17 })).toHaveLength(1);
});

test("`r` is 8 and `p` is 1.", async () => {
  const ctx = await ctxWithLn(simCtx(), 19);
  expect(await hashText(ctx, "hunter2")).toMatch(/^\$scrypt-sim\$ln=19,r=8,p=1\$/);
});

test("`rehash` is true when `stored` is below the ctx's cost: a lower `ln`, a salt under 16 bytes or a key under 32; the caller then stores a new `hash`.", async () => {
  const ctx = realCtx();
  const text = "hunter2";
  const make = (saltLen: number, keyLen: number): string => {
    const salt = Uint8Array.from(randomBytes(saltLen));
    const key = scryptSync(Buffer.from(text, "utf8"), salt, keyLen, {
      N: 2 ** 17,
      r: 8,
      p: 1,
      maxmem: 256 * 1024 * 1024,
    });
    return `$scrypt$ln=17,r=8,p=1$${b64(salt)}$${b64(key)}`;
  };
  const cases: [string, number, number, boolean][] = [
    ["salt 16, key 32", 16, 32, false],
    ["salt 15, key 32", 15, 32, true],
    ["salt 8, key 32", 8, 32, true],
    ["salt 16, key 31", 16, 31, true],
    ["salt 16, key 16", 16, 16, true],
    ["salt 24, key 48", 24, 48, false],
  ];
  for (const [label, saltLen, keyLen, expected] of cases) {
    const r = await credentials(ctx).verify(secretOf(text), hashedOf(make(saltLen, keyLen)));
    expect(isOk(r), label).toBe(true);
    expect(rehashOf(r), label).toBe(expected);
  }
  const sim = simCtx();
  expect(rehashOf(await credentials(sim).verify(secretOf(text), hashedOf(await hashText(sim, text))))).toBe(false);
  expect(errorOf(await credentials(sim).verify(secretOf("other"), hashedOf(await hashText(sim, text)))).code).toBe(
    "credentials.mismatch",
  );
}, 120_000);
