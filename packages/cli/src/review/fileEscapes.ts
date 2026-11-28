import type { Raw } from "./Raw.ts";
import { codeEscapes } from "./codeEscapes.ts";
import { kindOf } from "./kindOf.ts";
import { lockEscapes } from "./lockEscapes.ts";
import { manifestEscapes } from "./manifestEscapes.ts";
import { workspaceEscapes } from "./workspaceEscapes.ts";

const CODE = /\.(?:[cm]?[jt]sx?)$/;
const LOCKS = new Set(["pnpm-lock.yaml", "package-lock.json", "yarn.lock"]);
const ALLOW_WORD = /\bKEEL_ALLOW_ORIGINS\b/g;

/**
 * Every escape of k.escapes that one file holds at one revision (the range codes aside): code files by syntax,
 * `package.json`, `pnpm-workspace.yaml` and lockfiles by their entries, a tracked `node_modules/` file, a `patches/`
 * file at the git root or a project's root, and `KEEL_ALLOW_ORIGINS` in any text file but Markdown. `dir` is the
 * file's project (a git-root path ending `/`, `""` at the root) or null outside every project. `supervisor` is the
 * snapshot's (`supervisorsOf`), for R1018's app calls.
 */
export function fileEscapes(
  path: string,
  source: string,
  dir: string | null,
  supervisor?: (spec: string, name: string) => string | undefined,
): Raw[] {
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (/(?:^|\/)node_modules\//.test(path))
    return [{ code: "R1101", line: 1, col: 1, text: "", message: "a tracked file under node_modules/" }];
  const own = dir === null ? path : path.slice(dir.length);
  if (own.startsWith("patches/")) return [{ code: "R1101", line: 1, col: 1, text: "", message: "a dependency patch" }];
  if (source.includes("\u0000")) return [];
  const out: Raw[] = [];
  if (CODE.test(path)) out.push(...codeEscapes(path, source, kindOf(path, dir), supervisor));
  else if (name === "package.json") out.push(...manifestEscapes(source));
  else if (name === "pnpm-workspace.yaml") out.push(...workspaceEscapes(source));
  else if (LOCKS.has(name)) out.push(...lockEscapes(name, source));
  if (!/\.mdx?$/.test(name) && out.every((r) => r.code !== "R1150"))
    for (const m of source.matchAll(ALLOW_WORD)) {
      const i = m.index;
      const line = source.slice(0, i).split("\n").length;
      out.push({ code: "R1011", line, col: i - source.lastIndexOf("\n", i - 1), text: m[0] });
    }
  return out;
}
