// Seed 1337
// Spec: k.explain, clause "`@keel/check` has no `explain` export. `@keel/check/explain` exports `explain`, and for every code in `reportedCodes()` it returns at most 120 tokens naming the code."
// Spec: k.explain, clause "A rule registered with `defineRule` imported from `@keel/check` is explained by `explain` from `@keel/check/explain`: its message, its `explain` text and its `see`."
// Spec: k.explain, clause "The `@keel/check` entry bundled alone (esbuild, minified esm, dependencies external) contains no reason line and no fix example of any kernel code's explanation; the `@keel/check/explain` entry bundled alone contains every one."
// Spec: k.explain, clause "`tooling/budgets.json` has a size line for `@keel/check` and one for `@keel/check/explain`."
import { fixedTime } from "@keel/tooling/test-time";
import { readFileSync } from "node:fs";
import { defineRule, reportedCodes } from "@keel/check";
import * as main from "@keel/check";
import { explain } from "@keel/check/explain";
import { build } from "esbuild";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, approxTokens } from "./support.ts";

const PKG = new URL("../", import.meta.url);
const ROOT = new URL("../../../", import.meta.url);

// clause 1
test("@keel/check has no explain export", () => {
  expect("explain" in main).toBe(false);
  expect(Object.keys(main)).not.toContain("explain");
});

test("@keel/check/explain exports explain, a synchronous function", () => {
  expect(typeof explain).toBe("function");
  expect(typeof explain(reportedCodes()[0] ?? "E1000")).toBe("string");
});

test("for every code in reportedCodes() explain returns at most 120 tokens naming the code", () => {
  const codes = reportedCodes();
  expect(codes.length).toBeGreaterThan(0);
  fc.assert(
    fc.property(fc.constantFrom(...codes), (code) => {
      const text = explain(code);
      expect(text, code).toContain(code);
      expect(approxTokens(text), code).toBeLessThanOrEqual(120);
    }),
    { seed: SEED, numRuns: codes.length * 2 },
  );
});

// clause 2
test("a rule registered with defineRule from @keel/check is explained by explain from @keel/check/explain: message, explain text and see", () => {
  const word = fc.stringMatching(/^[a-z]{4,10}( [a-z]{4,10}){0,2}$/);
  const sample = fc.sample(
    fc.record({
      n: fc.integer({ min: 2700, max: 2799 }),
      message: word,
      text: word,
      see: fc.constantFrom("k.check", "k.explain", "k.cli"),
    }),
    { seed: SEED, numRuns: 30 },
  );
  const seen = new Set<number>();
  for (const s of sample) {
    if (seen.has(s.n)) continue;
    seen.add(s.n);
    const code = `E${s.n}`;
    defineRule({ code, message: s.message, see: s.see, explain: s.text, check: () => [] });
    const out = explain(code);
    expect(out, code).toContain(s.message);
    expect(out, code).toContain(s.text);
    expect(out, code).toContain(s.see);
  }
  expect(seen.size).toBeGreaterThan(0);
});

// clause 3
const bundle = async (entry: string): Promise<string> => {
  const out = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: "esm",
    platform: "node",
    packages: "external",
    write: false,
    logLevel: "silent",
  });
  return out.outputFiles[0]?.text ?? "";
};

const spellings = (line: string): string[] => [
  line,
  JSON.stringify(line).slice(1, -1),
  line.replace(/\\/g, "\\\\").replace(/'/g, "\\'"),
  line.replace(/\\/g, "\\\\").replace(/`/g, "\\`"),
];

const exportTarget = (key: string): string => {
  const pkg: unknown = JSON.parse(readFileSync(new URL("package.json", PKG), "utf8"));
  const exports = typeof pkg === "object" && pkg !== null && "exports" in pkg ? pkg.exports : undefined;
  const entry =
    typeof exports === "object" && exports !== null && key in exports ? Reflect.get(exports, key) : undefined;
  const file =
    typeof entry === "string"
      ? entry
      : typeof entry === "object" && entry !== null && "default" in entry && typeof entry.default === "string"
        ? entry.default
        : undefined;
  if (file === undefined) throw new Error(`@keel/check has no export ${key}`);
  return new URL(file, PKG).pathname;
};

test(
  "the @keel/check entry bundled alone has no reason line and no fix example of any kernel code; the @keel/check/explain entry bundled alone has every one",
  async () => {
    const mainBundle = await bundle(exportTarget("."));
    const explainBundle = await bundle(exportTarget("./explain"));
    const kernel = reportedCodes().filter((c) => /^[EWI]1\d{3}$/.test(c));
    expect(kernel.length).toBeGreaterThan(0);
    let checked = 0;
    for (const code of kernel) {
      const lines = explain(code).split("\n").slice(1);
      for (const raw of lines) {
        if (raw.startsWith("see:")) continue;
        const line = raw.startsWith("fix: ") ? raw.slice("fix: ".length) : raw;
        if (line.length === 0) continue;
        checked++;
        for (const s of spellings(line)) expect(mainBundle.includes(s), `${code} in main: ${line}`).toBe(false);
        expect(
          spellings(line).some((s) => explainBundle.includes(s)),
          `${code} in explain entry: ${line}`,
        ).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(0);
  },
  fixedTime(60_000),
);

// clause 4
test("tooling/budgets.json has a size line for @keel/check and one for @keel/check/explain", () => {
  const budgets: unknown = JSON.parse(readFileSync(new URL("tooling/budgets.json", ROOT), "utf8"));
  const size = typeof budgets === "object" && budgets !== null && "size" in budgets ? budgets.size : undefined;
  expect(typeof size).toBe("object");
  for (const name of ["@keel/check", "@keel/check/explain"]) {
    const line = typeof size === "object" && size !== null ? Reflect.get(size, name) : undefined;
    expect(line, name).toBeDefined();
    const max =
      typeof line === "string"
        ? line
        : typeof line === "object" && line !== null
          ? Reflect.get(line, "max")
          : undefined;
    expect(typeof max, name).toBe("string");
  }
});
