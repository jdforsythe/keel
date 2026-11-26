// Shared fixtures for the k.looks and k.schemes check conformance (not a test file). Public API only. Seed 1337.
// The k.looks Conformance fixture: `modules/shop/module.ts` lists `'@acme/ui'`, `node_modules/@acme/ui/` holds the k.library fixture's files with
// `id: 'acme'`, a `./tokens` entry, `src/acmeTokens.ts` and `src/Badge.tsx`.
// ASSUMPTIONS (spec silent): `check()` reads the app's `tokens.ts` and the shipped `src/<id>Tokens.ts` from the files it is given, as text (k.looks Shipped
// tokens: "`keel check` reads it as text and never runs it"); no `artifacts.tokens` is passed for E1810, E1811, E1812 and E1813, since the fix is applied to the text and the
// next `keel check` must read the patched text. "At <name>" is a position on that name's line from its first column to its last. A diagnostic's `message`, `path`, `line`, `col` and `fix` are
// those of `Diagnostic`.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check } from "@keel/check";
import { manifestFile } from "./module-support.ts";
import type { Files } from "./support.ts";

export { SEED } from "./support.ts";
export type { Files };

export const NO_TYPES = { types: false } as const;
export const ROOT = "node_modules/@acme/ui";
export const SHIPPED = `${ROOT}/src/acmeTokens.ts`;
export const PACKAGE_JSON = `${ROOT}/package.json`;
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;

/** `src/acmeTokens.ts` as the k.looks Conformance fixture writes it; `color` is the source text of the `color` group's body. */
export const shippedSource = (color = "'acme.accent': '#0B5CAD', 'acme.ink': '#FFFFFF'", extra = ""): string =>
  `import { defineTokens } from '@keel/ui'\n${extra}export const acmeTokens = defineTokens({ color: { ${color} }, look: { 'acme.badge': { bg: 'acme.accent', fg: 'acme.ink' } } })\n`;

/** `src/Badge.tsx`, its `Text` given `props` (source text of extra attributes). */
export const badgeSource = (props = ""): string =>
  `import { Text } from '@keel/ui'\nexport default function Badge(props: { id: string }) { return <Text id={\`\${props.id}.text\`} look="acme.badge"${props}>x</Text> }\n`;

export const exportsOf = (tokens: unknown): Record<string, unknown> => ({
  ".": { keel: "./src/index.ts", default: "./index.js" },
  ...(tokens === undefined ? {} : { "./tokens": tokens }),
});
export const packageJson = (tokens: unknown = { keel: "./src/acmeTokens.ts", default: "./index.js" }): string =>
  JSON.stringify(
    { name: "@acme/ui", version: "1.0.0", type: "module", keel: "library", exports: exportsOf(tokens) },
    null,
    2,
  );

/** The library's files under `node_modules/@acme/ui/`, `over` replacing files by path and `drop` removing them. */
export function acme(over: Files = [], drop: string[] = []): Files {
  const base: Files = [
    { path: PACKAGE_JSON, source: packageJson() },
    { path: `${ROOT}/index.js`, source: "export {}\n" },
    { ...manifestFile({ id: "acme", deps: [], exports: ["Badge"] }, ROOT) },
    { path: `${ROOT}/src/index.ts`, source: "export { default as Badge } from './Badge.tsx'\n" },
    { path: `${ROOT}/src/Badge.tsx`, source: badgeSource() },
    { path: SHIPPED, source: shippedSource() },
    { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
  ];
  const by = new Map(over.map((f) => [f.path, f]));
  return [
    ...base.filter((f) => !drop.includes(f.path)).map((f) => by.get(f.path) ?? f),
    ...over.filter((f) => !base.some((b) => b.path === f.path)),
  ];
}

/** The app: `modules/shop` listing `'@acme/ui'`, importing `Badge`, and `tokens.ts` holding `tokensSource` (none when undefined). */
export function app(tokensSource: string | undefined, over: Files = [], drop: string[] = []): Files {
  return [
    manifestFile({ id: "shop", deps: ["@acme/ui"] }),
    {
      path: "modules/shop/Page.tsx",
      source: `import { Badge } from '@acme/ui'\nexport default function Page() { return <Badge id="shop.badge" /> }\n`,
    },
    ...(tokensSource === undefined ? [] : [{ path: "tokens.ts", source: tokensSource }]),
    ...acme(over, drop),
  ];
}

export const BRAND_ONLY = `import { brandTokens } from "@keel/ui/brand";\nexport const tokens = brandTokens;\n`;
const FIXED_HEAD = `import { defineTokens } from "@keel/ui";\nimport { brandTokens } from "@keel/ui/brand";\nimport { acmeTokens } from "@acme/ui/tokens";\n`;
/** `tokens.ts` as the fix writes it (k.looks Conformance), `color` and `look` the source text of each group's body after the shipped spread. */
export const fixedTokens = (colorTail = "", lookSpread = "...acmeTokens.look"): string =>
  `${FIXED_HEAD}\nexport const tokens = defineTokens({\n  ...brandTokens,\n  color: { ...brandTokens.color, ...acmeTokens.color${colorTail} },\n  look: { ...brandTokens.look${lookSpread === "" ? "" : `, ${lookSpread}`} },\n});\n`;

export const codesOf = (files: Files, code: string) =>
  check(files, NO_TYPES).diagnostics.filter((d) => d.code === code);
export const sourceOf = (files: Files, path: string): string => files.find((f) => f.path === path)?.source ?? "";

/** The 1-based line and column of the first `needle` in `source`. */
export function positionOf(source: string, needle: string, from = 0): { line: number; col: number } {
  const idx = source.indexOf(needle, from);
  if (idx < 0) throw new Error(`fixture: no ${needle}`);
  const before = source.slice(0, idx);
  return { line: before.split("\n").length, col: idx - before.lastIndexOf("\n") };
}

/** Whether (`line`, `col`) lies on `needle`'s first occurrence in `source`, one column before it (an opening quote) to its last. */
export function atText(source: string, needle: string, line: number, col: number, from = 0): boolean {
  const p = positionOf(source, needle, from);
  return line === p.line && col >= p.col - 1 && col <= p.col + needle.length - 1;
}

/** Write `files` to a fresh temp dir, `git apply` the fix there, and return the patched files (as fix-diffs.test.ts does). */
export function applyFix(files: Files, fix: string): Files {
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

/** Source with whitespace, trailing commas and quote style removed: the form two writings of one object literal share. */
export const squash = (source: string): string =>
  source
    .replace(/'/g, '"')
    .replace(/\s+/g, "")
    .replace(/,([}\])])/g, "$1")
    .replace(/;/g, "");
