import { isAbsolute, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { attempt } from "@keel/schema";

const MAX = 5;
const IN_PARENS = /\(([^()]+):(\d+):(\d+)\)$/;
const BARE = /^at (.+):(\d+):(\d+)$/;

const fileOf = (at: string): string | undefined => {
  if (!at.startsWith("file:")) return at;
  const file = attempt(() => fileURLToPath(at));
  return file.ok ? file.value : undefined;
};

const library = (rel: string): boolean =>
  rel.startsWith("packages/") || rel.startsWith(".keel/") || rel.split("/").includes("node_modules");

/**
 * The first 5 stack positions of `thrown` in app code (k.server Log), each `<path>:<line>:<col>` with the path
 * relative to `cwd`. Read from the `at` lines of an `Error`'s `stack`; a position outside `cwd` (Node internals, a home
 * directory, the global store) or under `packages/`, `node_modules/` or `.keel/` is dropped, and function names are not
 * kept. Anything without a string `stack` gives `[]`.
 */
export function appFrames(thrown: unknown, cwd: string): string[] {
  const stack = thrown instanceof Error ? thrown.stack : undefined;
  if (typeof stack !== "string") return [];
  const out: string[] = [];
  for (const raw of stack.split("\n").slice(1)) {
    const line = raw.trim();
    const m = line.startsWith("at ") ? (IN_PARENS.exec(line) ?? BARE.exec(line)) : null;
    const file = m?.[1] === undefined ? undefined : fileOf(m[1]);
    if (m === null || file === undefined || !isAbsolute(file)) continue;
    const rel = relative(cwd, file).split(sep).join("/");
    if (rel === "" || rel.startsWith("../") || isAbsolute(rel) || library(rel)) continue;
    out.push(`${rel}:${m[2]}:${m[3]}`);
    if (out.length === MAX) break;
  }
  return out;
}
