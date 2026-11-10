// Spec: std.text, clause "`Email` accepts `a.b+c@example.co` and rejects `a@b`, `a..b@example.com`, `é@example.com`, `@example.com` and a 255-character address; `Slug` accepts `pasta-bake-2` and rejects `Pasta`, `-a`, `a--b` and `''`. Each rejection has rule `format`."
// Seed 1337
import { Email, Slug } from "@keel/std-text";
import fc from "fast-check";
import { expect, test } from "vitest";

function rules(
  schema: { parse(i: unknown): { ok: boolean; error?: { data: { issues: readonly { rule: string }[] } } } },
  input: unknown,
): string[] {
  const r = schema.parse(input);
  expect(r.ok).toBe(false);
  return r.ok || !r.error ? [] : r.error.data.issues.map((i) => i.rule);
}

test.skip("`Email` accepts `a.b+c@example.co` and rejects `a@b`, `a..b@example.com`, `é@example.com`, `@example.com` and a 255-character address; `Slug` accepts `pasta-bake-2` and rejects `Pasta`, `-a`, `a--b` and `''`. Each rejection has rule `format`.", () => {
  const long = `${"a".repeat(64)}@${"a".repeat(63)}.${"a".repeat(63)}.${"a".repeat(58)}.com`;
  expect(long.length).toBe(255);
  expect(Email.parse("a.b+c@example.co").ok).toBe(true);
  for (const bad of ["a@b", "a..b@example.com", "é@example.com", "@example.com", long]) {
    expect(rules(Email, bad)).toContain("format");
  }
  expect(Slug.parse("pasta-bake-2").ok).toBe(true);
  for (const bad of ["Pasta", "-a", "a--b", ""]) {
    expect(rules(Slug, bad)).toContain("format");
  }
});

test.skip("`Email` keeps the address as written, with no case folding (property).", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[A-Za-z0-9]{1,20}$/), fc.stringMatching(/^[A-Za-z0-9]{1,20}$/), (local, label) => {
      const addr = `${local}@${label}.Com`;
      const r = Email.parse(addr);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe(addr);
    }),
    { seed: 1337, numRuns: 100 },
  );
});

test.skip("`Slug` accepts every 1 to 64 character run of `a-z` and `0-9` in hyphen-separated runs and rejects uppercase, 65 characters and edge hyphens (property).", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z0-9]{1,10}(-[a-z0-9]{1,10}){0,4}$/), (v) => {
      expect(Slug.parse(v).ok).toBe(true);
      expect(Slug.parse(v.toUpperCase()).ok).toBe(v.toUpperCase() === v);
      expect(Slug.parse(`-${v}`).ok).toBe(false);
      expect(Slug.parse(`${v}-`).ok).toBe(false);
    }),
    { seed: 1337, numRuns: 100 },
  );
  expect(Slug.parse("a".repeat(64)).ok).toBe(true);
  expect(Slug.parse("a".repeat(65)).ok).toBe(false);
});
