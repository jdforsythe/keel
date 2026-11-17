import { existsSync, readFileSync, statSync } from "node:fs";
import { SourceMap } from "node:module";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { attempted } from "./attempted.ts";

const MAX = 5;
/** Largest `server.mjs.map` read (bytes). */
const MAX_MAP = 32 * 1024 * 1024;
const IN_PARENS = /\(([^()]+):(\d+):(\d+)\)$/;
const BARE = /^at (.+):(\d+):(\d+)$/;

/** The file path of a frame location, without any `?query` or `#hash` (a dev server's `?t=` or a token). */
const fileOf = (at: string): string | undefined => {
  const bare = at.replace(/[?#].*$/s, "");
  if (!bare.startsWith("file:")) return bare;
  const file = attempted(() => fileURLToPath(bare));
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
 * no mapping there it is dropped. A map that is missing, over 32 MB or malformed is reported once to `warn`. Beside a
 * `server.mjs`, a position under `<artifacts>/` is one Node already mapped (`--enable-source-maps` resolves the map's
 * project-relative sources against its folder), so it is taken relative to `<artifacts>`. A position outside the root,
 * or under `packages/`, `node_modules/` or `.keel/`, is dropped; function names, a `?query` and a `#hash` are not kept.
 * No `artifacts`, or no string `stack`: `[]`.
 */
export function appFrames(
  artifacts: string | undefined,
  warn: (message: string) => void,
): (thrown: unknown) => string[] {
  if (artifacts === undefined) return () => [];
  const dir = resolve(artifacts);
  const root = dirname(dir);
  const bundle = join(dir, "server.mjs");
  let map: SourceMap | null | undefined;
  let built: boolean | undefined;
  const source = (line: number, col: number): string | undefined => {
    if (map === undefined) {
      const file = `${bundle}.map`;
      const read = attempted(() => {
        if (statSync(file).size > MAX_MAP) throw new Error("over 32 MB");
        return new SourceMap(JSON.parse(readFileSync(file, "utf8")));
      });
      map = read.ok ? read.value : null;
      if (!read.ok) warn("server.mjs.map missing, over 32 MB or malformed; frames in server.mjs are dropped");
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
      built ??= existsSync(bundle);
      const mapped = built && file.startsWith(`${dir}${sep}`);
      const at =
        file === bundle
          ? source(Number(m[2]), Number(m[3]))
          : `${relative(mapped ? dir : root, file)
              .split(sep)
              .join("/")}:${m[2]}:${m[3]}`;
      if (at === undefined || library(at.replace(/:\d+:\d+$/, ""))) continue;
      out.push(at);
      if (out.length === MAX) break;
    }
    return out;
  };
}
