// Spec: std.brands, clause "After importing `@keel/std-brands`, `rules()` lists E2101 and `explain('E2101')` returns the rule's explain text, at most 120 tokens."
// Spec: std.brands, clause "For generated non-PascalCase brands (lower, snake, kebab, camel), `s.id('<b>')` reports exactly one E2101 at the literal's line and col; `ctx.random.id('<b>')` does too."
// Spec: std.brands, clause "A file whose brands are all PascalCase literals, variables, or other expressions reports no E2101."
// Spec: std.brands, clause "For each generated E2101 with a fix, the fix applies to its file with `git apply`, and re-checking the patched file reports no E2101."
// Spec: std.brands, clause "The fixed brand of `user_id`, `user-id` and `userId` is `UserId`; the quote character is kept."
// Spec: std.brands, clause "A brand with no letter-led PascalCase form (`'_'`, `'1st'`) reports E2101 without a `fix`."
// Seed 1337 (fast-check seed, recorded in each fc.assert below).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check, explain, rules } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { idBrandCase } from "@keel/std-brands";

const SEED = 1337;
type Files = Parameters<typeof check>[0];
const NO_TYPES = { types: false } as const;
const codes = (files: Files) => check(files, NO_TYPES).diagnostics.filter((d) => d.code === "E2101");
const file = (source: string, path = "a.ts"): Files => [{ path, source }];
const sApi = (b: string, q = "'") => `import { s } from '@keel/schema'\nexport const A = s.id(${q}${b}${q})\n`;
const ctxApi = (b: string, q = "'") => `export function f(ctx) {\n  return ctx.random.id(${q}${b}${q})\n}\n`;

function applyFix(files: Files, fix: string): Files {
  const dir = mkdtempSync(join(tmpdir(), "keel-fix-"));
  try {
    for (const f of files) {
      mkdirSync(dirname(join(dir, f.path)), { recursive: true });
      writeFileSync(join(dir, f.path), f.source);
    }
    writeFileSync(join(dir, "fix.patch"), `${fix}\n`);
    execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir, stdio: "pipe" });
    return files.map((f) => ({ path: f.path, source: readFileSync(join(dir, f.path), "utf8") }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const lower = fc.stringMatching(/^[a-z]{2,8}$/);
const snake = fc.stringMatching(/^[a-z]{2,6}_[a-z]{2,6}$/);
const kebab = fc.stringMatching(/^[a-z]{2,6}-[a-z]{2,6}$/);
const camel = fc.stringMatching(/^[a-z]{2,6}[A-Z][a-z]{2,6}$/);
const badBrand = fc.oneof(lower, snake, kebab, camel);

test("After importing `@keel/std-brands`, `rules()` lists E2101 and `explain('E2101')` returns the rule's explain text, at most 120 tokens.", () => {
  expect(idBrandCase.code).toBe("E2101");
  expect(idBrandCase.see).toBe("std.brands");
  expect(JSON.stringify(rules())).toContain("E2101");
  const text = explain("E2101");
  expect(text).toContain(idBrandCase.explain);
  expect(Math.ceil(text.length / 4)).toBeLessThanOrEqual(120);
});

test("For generated non-PascalCase brands (lower, snake, kebab, camel), `s.id('<b>')` reports exactly one E2101 at the literal's line and col", () => {
  fc.assert(
    fc.property(badBrand, fc.integer({ min: 0, max: 5 }), (b, pad) => {
      const source = `import { s } from '@keel/schema'\n${"\n".repeat(pad)}export const A = s.id('${b}')\n`;
      const d = codes(file(source));
      expect(d.length).toBe(1);
      expect(d[0]?.line).toBe(pad + 2);
      expect(d[0]?.col).toBe("export const A = s.id(".length + 1);
      expect(d[0]?.path).toBe("a.ts");
      expect(d[0]?.message).toContain(`id brand '${b}' is not PascalCase`);
    }),
    { seed: SEED, numRuns: 60 },
  );
});

test("For generated non-PascalCase brands (lower, snake, kebab, camel), `ctx.random.id('<b>')` reports exactly one E2101 at the literal's line and col", () => {
  fc.assert(
    fc.property(badBrand, (b) => {
      const d = codes(file(ctxApi(b)));
      expect(d.length).toBe(1);
      expect(d[0]?.line).toBe(2);
      expect(d[0]?.col).toBe("  return ctx.random.id(".length + 1);
    }),
    { seed: SEED, numRuns: 60 },
  );
});

test("A file whose brands are all PascalCase literals, variables, or other expressions reports no E2101", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[A-Z][A-Za-z0-9]{0,8}$/), (b) => {
      const source = `import { s } from '@keel/schema'
const dyn = 'user_id'
export const A = s.id('${b}')
export const B = s.id(dyn)
export const C = s.id(dyn + '_x')
export const D = s.id(\`${b}\`)
export function f(ctx) { return [ctx.random.id('${b}'), ctx.random.id(dyn), ctx.random.id(\`a\${dyn}\`)] }
`;
      expect(codes(file(source))).toEqual([]);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("For each generated E2101 with a fix, the fix applies to its file with `git apply`, and re-checking the patched file reports no E2101", () => {
  fc.assert(
    fc.property(badBrand, fc.constantFrom("'", '"', "`"), fc.boolean(), (b, q, viaCtx) => {
      const files = file(viaCtx ? ctxApi(b, q) : sApi(b, q));
      const d = codes(files);
      expect(d.length).toBe(1);
      const fix = d[0]?.fix;
      expect(typeof fix).toBe("string");
      if (fix === undefined) return;
      const patched = applyFix(files, fix);
      expect(patched).not.toEqual(files);
      expect(codes(patched)).toEqual([]);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("The fixed brand of `user_id`, `user-id` and `userId` is `UserId`; the quote character is kept.", () => {
  for (const b of ["user_id", "user-id", "userId"]) {
    for (const q of ["'", '"', "`"]) {
      const files = file(sApi(b, q));
      const d = codes(files);
      expect(d.length).toBe(1);
      expect(d[0]?.message).toBe(`id brand '${b}' is not PascalCase; use 'UserId'`);
      const fix = d[0]?.fix;
      if (fix === undefined) throw new Error("expected a fix");
      const patched = applyFix(files, fix);
      expect(patched[0]?.source).toBe(sApi("UserId", q));
    }
  }
});

test("A brand with no letter-led PascalCase form (`'_'`, `'1st'`) reports E2101 without a `fix`.", () => {
  for (const b of ["_", "1st"]) {
    const d = codes(file(sApi(b)));
    expect(d.length).toBe(1);
    expect(d[0]?.fix).toBeUndefined();
    expect(d[0]?.message).toBe(`id brand '${b}' is not PascalCase`);
    const c = codes(file(ctxApi(b)));
    expect(c.length).toBe(1);
    expect(c[0]?.fix).toBeUndefined();
  }
});
