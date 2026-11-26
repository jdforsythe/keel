// Shared fixtures for the k.looks and k.schemes check conformance (not a test file). Public API only. Seed 1337.
// The k.looks Conformance fixture: `modules/shop/module.ts` lists `'@acme/ui'`, `node_modules/@acme/ui/` holds the k.library fixture's files with
// `id: 'acme'`, a `./tokens` entry, `src/acmeTokens.ts` and `src/Badge.tsx`.
// k.looks In an app: E1810 to E1814 judge the evaluated `tokens` export of the project's `tokens.ts` (k.a11y-static Tokens), which `check()` is given as
// `artifacts: { tokens }`, and read the file's text only for positions and the fix. A case that expects a diagnostic gives both the file and the artifact the file evaluates to
// (`composed`, `brandTokens`); the next check after a fix is given the artifact of the fixed file. A shipped `src/<id>Tokens.ts` is read as text (k.looks Shipped tokens).
// "At <name>" is a position on that name's line from its first column to its last. A diagnostic's `message`, `path`, `line`, `col` and `fix` are those of `Diagnostic`.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check } from "@keel/check";
import { repoRoot } from "@keel/tooling/repo-root";
import { defineTokens } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";
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

export type Tokens = ReturnType<typeof defineTokens>;
/** The evaluated `tokens` export of `fixedTokens(...)`'s file: `brandTokens` with the shipped object's `color` and `look` composed, `color` then overriding by name. */
export function composed(color: Record<string, string> = {}, look = true): Tokens {
  return defineTokens({
    ...brandTokens,
    color: { ...brandTokens.color, "acme.accent": "#0B5CAD", "acme.ink": "#FFFFFF", ...color },
    look: { ...brandTokens.look, ...(look ? { "acme.badge": { bg: "acme.accent", fg: "acme.ink" } } : {}) },
  });
}
/** `check()`'s options for a project whose `tokens.ts` evaluates to `tokens` (none: a project with no tokens artifact). */
export const optsFor = (tokens?: Tokens) =>
  tokens === undefined ? NO_TYPES : ({ types: false, artifacts: { tokens } } as const);
export const diagnosticsOf = (files: Files, tokens?: Tokens) => check(files, optsFor(tokens)).diagnostics;
export const codesOf = (files: Files, code: string, tokens?: Tokens) =>
  diagnosticsOf(files, tokens).filter((d) => d.code === code);
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

/** `source` as `biome format` writes it under the repo's configuration: a fix's layout is not judged (k.looks Fix). */
export function formatted(source: string, name = "tokens.ts"): string {
  return execFileSync("pnpm", ["exec", "biome", "format", `--stdin-file-path=${name}`], {
    cwd: repoRoot(import.meta.dirname),
    input: source,
    encoding: "utf8",
  });
}
