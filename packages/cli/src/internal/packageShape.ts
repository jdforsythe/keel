import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Diag } from "./Diag.ts";
import { isRecord } from "./isRecord.ts";
import { jsonFieldAt } from "./jsonFieldAt.ts";
import { makeDiag } from "./makeDiag.ts";
import { filesSelect, packFiles } from "./packFiles.ts";

/** The paths `files` must select: what an app reads of a library (k.library-pack Package). */
const NEEDED = ["module.ts", ".keel/ledger.json"];
/** A secret's file: never in a tarball. */
const SECRET = /(?:^|\/)\.env(?:\.[^/]*)?$/;
const clip = (x: string): string => (x.length > 28 ? `${x.slice(0, 25)}...` : x);

/** Each string target of an `exports` value, its conditions nested or not, with the condition naming it. */
const targets = (value: unknown, cond = "default"): [string, string][] =>
  typeof value === "string"
    ? [[cond, value]]
    : isRecord(value)
      ? Object.entries(value).flatMap(([k, v]) => targets(v, k))
      : [];

/**
 * Binary only: the first reason the library at `dir` (`pkg` its parsed `package.json`, `text` the file) is no package
 * an app reads, checks and trusts as the folder does (k.library-pack Pack, step `package`), or undefined:
 * no root `module.ts`; an `exports` with no `"."` entry whose `keel` condition comes first, or an entry listing `keel`
 * after another condition; a `keel` target that is no `.ts` or `.tsx` file under `src/` or `unsafe/`; a `files` list
 * missing, or not selecting `module.ts`, `.keel/ledger.json`, every file under `src/` and `unsafe/`, or an `exports`
 * target; or a tarball by `files` holding a `.env` file or the root `tokens.ts`. One E1164 at the `package.json` field,
 * a column into its value; its message begins `package`.
 */
export function packageShape(dir: string, pkg: Readonly<Record<string, unknown>>, text: string): Diag | undefined {
  const at = (key: string, message: string): Diag =>
    makeDiag("E1164", `package ${message}`, { path: "package.json", ...(jsonFieldAt(text, key) ?? { line: 1, col: 1 }), see: "k.library-pack" });
  if (!existsSync(join(dir, "module.ts"))) return at("keel", "has no root module.ts, the library's manifest");
  const exports = isRecord(pkg.exports) ? pkg.exports : {};
  const dot = exports["."];
  if (!isRecord(dot) || Object.keys(dot)[0] !== "keel") return at("exports", 'exports "." lists no keel condition first');
  for (const [key, value] of Object.entries(exports)) {
    if (!isRecord(value) || !Object.hasOwn(value, "keel")) continue;
    if (Object.keys(value)[0] !== "keel") return at("exports", `exports ${clip(JSON.stringify(key))} lists keel after another`);
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
      if (!filesSelect(files, rel)) return at("files", `files omits ${clip(rel)}, exports ${clip(JSON.stringify(key))}`);
    }
  const secret = shipped.find((p) => SECRET.test(p));
  if (secret !== undefined) return at("files", `files ships ${clip(secret)}, a secret's file`);
  if (shipped.includes("tokens.ts")) return at("files", "files ships tokens.ts; an app checks the library against its own");
  return undefined;
}
