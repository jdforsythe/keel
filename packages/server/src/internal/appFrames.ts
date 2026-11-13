import { readFileSync } from "node:fs";
import { SourceMap } from "node:module";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { attempt } from "@keel/schema";

const MAX = 5;
const IN_PARENS = /\(([^()]+):(\d+):(\d+)\)$/;
const BARE = /^at (.+):(\d+):(\d+)$/;

/** The file path of a frame location, without any `?query` or `#hash` (a dev server's `?t=` or a token). */
const fileOf = (at: string): string | undefined => {
  const bare = at.replace(/[?#].*$/s, "");
  if (!bare.startsWith("file:")) return bare;
  const file = attempt(() => fileURLToPath(bare));
  return file.ok ? file.value : undefined;
};

const library = (rel: string): boolean =>
  rel === "" ||
  rel.startsWith("../") ||
  isAbsolute(rel) ||
  rel.startsWith("packages/") ||
  rel.startsWith(".keel/") ||
  rel.split("/").includes("node_modules");

/**
 * The frame reader of an app whose `createApp({ artifacts })` is `artifacts` (k.server Log): given a thrown value, the
 * first 5 stack positions of its `stack` in app code, each `<path>:<line>:<col>` relative to the folder holding
 * `artifacts`. A position in `<artifacts>/server.mjs` (the production bundle) is replaced by its source position in
 * `server.mjs.map` (its sources are relative to the project already), read once, on the first such frame; with no map or
 * no mapping there it is dropped. A position outside that folder, or under `packages/`, `node_modules/` or `.keel/`, is
 * dropped; function names, a `?query` and a `#hash` are not kept. No `artifacts`, or no string `stack`: `[]`.
 */
export function appFrames(artifacts: string | undefined): (thrown: unknown) => string[] {
  if (artifacts === undefined) return () => [];
  const dir = resolve(artifacts);
  const root = dirname(dir);
  const bundle = join(dir, "server.mjs");
  let map: SourceMap | null | undefined;
  const source = (line: number, col: number): string | undefined => {
    if (map === undefined) {
      const read = attempt(() => new SourceMap(JSON.parse(readFileSync(`${bundle}.map`, "utf8"))));
      map = read.ok ? read.value : null;
    }
    const e = map?.findEntry(line - 1, col - 1);
    return e !== undefined && "originalSource" in e
      ? `${e.originalSource}:${e.originalLine + 1}:${e.originalColumn + 1}`
      : undefined;
  };
  return (thrown) => {
    const stack = thrown instanceof Error ? thrown.stack : undefined;
    if (typeof stack !== "string") return [];
    const out: string[] = [];
    for (const raw of stack.split("\n").slice(1)) {
      const line = raw.trim();
      const m = line.startsWith("at ") ? (IN_PARENS.exec(line) ?? BARE.exec(line)) : null;
      const file = m?.[1] === undefined ? undefined : fileOf(m[1]);
      if (m === null || file === undefined || !isAbsolute(file)) continue;
      const at =
        file === bundle
          ? source(Number(m[2]), Number(m[3]))
          : `${relative(root, file).split(sep).join("/")}:${m[2]}:${m[3]}`;
      if (at === undefined || library(at.replace(/:\d+:\d+$/, ""))) continue;
      out.push(at);
      if (out.length === MAX) break;
    }
    return out;
  };
}
