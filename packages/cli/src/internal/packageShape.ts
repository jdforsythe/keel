import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CODE_FILE } from "./CODE_FILE.ts";
import type { Diag } from "./Diag.ts";
import { filesSelect } from "./filesSelect.ts";
import { isRecord } from "./isRecord.ts";
import { jsonFieldAt } from "./jsonFieldAt.ts";
import { makeDiag } from "./makeDiag.ts";
import { packFiles } from "./packFiles.ts";

/** The paths `files` must select: what an app reads of a library (k.library-pack Package). */
const NEEDED = ["module.ts", ".keel/ledger.json"];
/** A secret's file: never in a tarball. */
const SECRET = /(?:^|\/)\.env(?:\.[^/]*)?$/;
const clip = (x: string): string => (x.length > 28 ? `${x.slice(0, 25)}...` : x);

/** A bare `@keel/*` specifier of an import, re-export or `import()`: its package name. */
const KERNEL_IMPORT = /\b(?:from|import)\s*\(?\s*["'](@keel\/[a-z0-9-]+)/g;
/** What the compiler's output of JSX imports: in a library, from the library's own folder. */
const LOWERED = ["@keel/reactive", "@keel/runtime-dom"];

/**
 * The `@keel/*` packages the library at `dir` needs to resolve to the app's copies: those its `module.ts` and its
 * `src/` and `unsafe/` code files import, and those the compiler's output of a `.tsx` file imports. Sorted.
 */
function kernelImports(dir: string): string[] {
  const out = new Set<string>();
  for (const rel of ["module.ts", ...packFiles(dir, ["src", "unsafe"]).filter((p) => CODE_FILE.test(p))]) {
    let text: string;
    try {
      text = readFileSync(join(dir, rel), "utf8");
    } catch {
      continue;
    }
    for (const m of text.matchAll(KERNEL_IMPORT)) if (m[1] !== undefined) out.add(m[1]);
    if (rel.endsWith(".tsx")) for (const n of LOWERED) out.add(n);
  }
  return [...out].sort();
}

/** Whether a conditions value holds a `keel` key at any depth. */
const nestsKeel = (value: unknown): boolean =>
  isRecord(value) && (Object.hasOwn(value, "keel") || Object.values(value).some(nestsKeel));

/** Each string target of an `exports` value, its conditions nested or not, with the condition naming it. */
const targets = (value: unknown, cond = "default"): [string, string][] =>
  typeof value === "string"
    ? [[cond, value]]
    : isRecord(value)
      ? Object.entries(value).flatMap(([k, v]) => targets(v, k))
      : [];

/**
 * Binary only: the first reason the library at `dir` (`pkg` its parsed `package.json`, `text` the file) is no package
 * an app reads, checks and trusts as the folder does (k.library-pack Pack, step `package`), or undefined, in this order:
 * no root `module.ts`; an `exports` with no `"."` entry whose `keel` condition comes first, an entry holding `keel`
 * nested under another condition, or an entry listing `keel`
 * after another condition; a `keel` target that is no `.ts` or `.tsx` file under `src/` or `unsafe/`; a `files` list
 * missing, or not selecting `module.ts`, `.keel/ledger.json`, every file under `src/` and `unsafe/`, or an `exports`
 * target; a `@keel/*` package its files import, or the compiler's output of its JSX imports, that `peerDependencies`
 * omits or `dependencies` lists (`kernelImports`: a library's kernel imports resolve to the app's copies); or a tarball by `files` holding a
 * `.env` file or the root `tokens.ts`, or a code file outside `module.ts`, `src/`, `unsafe/` and `dist/`. One E1164 at the `package.json` field,
 * a column into its value; its message begins `package`.
 */
export function packageShape(dir: string, pkg: Readonly<Record<string, unknown>>, text: string): Diag | undefined {
  const at = (key: string, message: string): Diag =>
    makeDiag("E1164", `package ${message}`, {
      path: "package.json",
      ...(jsonFieldAt(text, key) ?? { line: 1, col: 1 }),
      see: "k.library-pack",
    });
  if (!existsSync(join(dir, "module.ts"))) return at("keel", "has no root module.ts, the library's manifest");
  const exports = isRecord(pkg.exports) ? pkg.exports : {};
  const dot = exports["."];
  if (!isRecord(dot) || Object.keys(dot)[0] !== "keel")
    return at("exports", 'exports "." lists no keel condition first');
  for (const [key, value] of Object.entries(exports)) {
    if (!isRecord(value)) continue;
    // The check reads an entry's `keel` at its top level alone, and a resolver takes the first matching condition at
    // each depth, so a `keel` under another condition is read by no reader of the library as its source.
    if (Object.values(value).some(nestsKeel))
      return at("exports", `exports ${clip(JSON.stringify(key))} nests keel under another condition`);
    if (!Object.hasOwn(value, "keel")) continue;
    if (Object.keys(value)[0] !== "keel")
      return at("exports", `exports ${clip(JSON.stringify(key))} lists keel after another`);
    const source = typeof value.keel === "string" ? value.keel.replace(/^\.\//, "") : "";
    if (!/^(?:src|unsafe)\/.+\.tsx?$/.test(source) || !existsSync(join(dir, source)))
      return at("exports", `exports ${clip(JSON.stringify(key))} keel is no file under src/ or unsafe/`);
  }
  const files = Array.isArray(pkg.files) ? pkg.files.filter((f) => typeof f === "string") : undefined;
  if (files === undefined) return at("keel", "lists no files, so a tarball would hold everything");
  for (const n of NEEDED) if (!filesSelect(files, n)) return at("files", `files omits ${n}`);
  const shipped = packFiles(dir, files);
  // Every file under `src/` and `unsafe/` is one the app reads, so each ships.
  for (const code of ["src", "unsafe"]) {
    const missed = packFiles(dir, [code]).find((p) => !shipped.includes(p));
    if (missed !== undefined) return at("files", `files omits ${clip(missed)}`);
  }
  for (const [key, value] of Object.entries(exports))
    for (const [, target] of targets(value)) {
      const rel = target.replace(/^\.\//, "");
      if (!filesSelect(files, rel))
        return at("files", `files omits ${clip(rel)}, exports ${clip(JSON.stringify(key))}`);
    }
  const peers = isRecord(pkg.peerDependencies) ? pkg.peerDependencies : {};
  const deps = isRecord(pkg.dependencies) ? pkg.dependencies : {};
  for (const n of kernelImports(dir)) {
    if (Object.hasOwn(deps, n)) return at("dependencies", `dependencies lists ${n}; a peer resolves to the app's`);
    if (!Object.hasOwn(peers, n))
      return at(isRecord(pkg.peerDependencies) ? "peerDependencies" : "keel", `peerDependencies omits ${n}`);
  }
  const secret = shipped.find((p) => SECRET.test(p));
  if (secret !== undefined) return at("files", `files ships ${clip(secret)}, a secret's file`);
  if (shipped.includes("tokens.ts"))
    return at("files", "files ships tokens.ts; an app checks the library against its own");
  // `keel check` reads a library's `module.ts`, `src/`, `unsafe/` and `test/` alone (asInstalled): code elsewhere would ship unread.
  const unread = shipped.find((p) => CODE_FILE.test(p) && !/^(?:module\.ts$|(?:src|unsafe|dist)\/)/.test(p));
  if (unread !== undefined) return at("files", `files ships ${clip(unread)}, code outside module.ts, src/ and unsafe/`);
  return undefined;
}
