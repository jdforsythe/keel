import fs from "node:fs";
import { SourceMap, type SourceMapPayload } from "node:module";
import path from "node:path";
import type { ProblemRecord } from "./ProblemRecord.ts";

/** What follows a refusal's `<what>` and its place (`HOST_BANNER`). */
const REST = ": Keel cannot see what it reads, so a build-time evaluation does not run it";
/** The longest `<what> at <file>:<line>` kept whole in a message (k.check Diagnostics: 86 units, then `...`). */
const KEPT = 86;

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> => typeof x === "object" && x !== null;
const strings = (x: unknown): boolean => Array.isArray(x) && x.every((s) => typeof s === "string");
/** esbuild's source map JSON. */
const isPayload = (x: unknown): x is SourceMapPayload =>
  isRecord(x) &&
  typeof x.version === "number" &&
  typeof x.mappings === "string" &&
  strings(x.sources) &&
  strings(x.names) &&
  (x.file === undefined || typeof x.file === "string") &&
  (x.sourceRoot === undefined || typeof x.sourceRoot === "string");

/** `<package name>/<path in the package>` of a file outside the project, by its nearest `package.json`; else its path. */
function packagePath(file: string): string {
  for (let dir = path.dirname(file); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const pj = path.join(dir, "package.json");
    if (!fs.existsSync(pj)) continue;
    try {
      const v: unknown = JSON.parse(fs.readFileSync(pj, "utf8"));
      const name = isRecord(v) ? v.name : undefined;
      if (typeof name === "string") return `${name}/${path.relative(dir, file).split(path.sep).join("/")}`;
    } catch {
      // A `package.json` that does not parse names no package: the next one up may.
    }
  }
  return file;
}

/**
 * Each problem record of an evaluation as a problem line (k.evaluator Placing, k.compiler Rules): a refusal (E1050
 * with `what`) placed at the first of its frames inside the project or a package, mapped through the bundle's source
 * map (`map`, read only when a refusal has frames): a project file's frame is the problem's position
 * (`E1050 <path>:<line>:<col> <what> at build time: ...`), a package's is named in its message
 * (`<what> at <package>/<path>:<line>:<col>: ...`, the file cut from its start with `...` when the two do not fit in
 * 86 units); a frame in no file on disk (a `data:` module, the banner) is skipped; with no such frame the message is
 * `<what> at build time: ...`. Any other record is `<code> <message>`.
 */
export function placeRefusals(
  problems: readonly ProblemRecord[],
  map: () => string | undefined,
  root: string,
): string[] {
  let source: SourceMap | undefined;
  const sourceMap = (): SourceMap | undefined => {
    if (source !== undefined) return source;
    const text = map();
    const v: unknown = text === undefined ? undefined : JSON.parse(text);
    if (isPayload(v)) source = new SourceMap(v);
    return source;
  };
  return problems.map((p) => {
    const what = p.what;
    if (p.code !== "E1050" || what === undefined) return `${p.code} ${p.message ?? ""}`;
    const frames = p.frames ?? [];
    const sm = frames.length === 0 ? undefined : sourceMap();
    for (const [line, col] of frames) {
      const e = sm?.findEntry(line - 1, col - 1);
      if (e === undefined || !("originalSource" in e)) continue;
      const file = e.originalSource;
      if (file.includes("<") || file.endsWith("keel-evaluate.js") || file.startsWith("data:")) continue;
      const abs = path.resolve(root, file.startsWith("file:") ? new URL(file).pathname : file);
      if (!fs.existsSync(abs)) continue;
      const rel = path.relative(root, abs).split(path.sep).join("/");
      const ownLine = e.originalLine + 1;
      const ownCol = e.originalColumn + 1;
      if (!rel.startsWith("../") && !path.isAbsolute(rel) && !rel.split("/").includes("node_modules"))
        return `E1050 ${rel}:${ownLine}:${ownCol} ${what} at build time${REST}`;
      let shown = `${packagePath(abs)}:${ownLine}:${ownCol}`;
      const room = KEPT - what.length - " at ".length;
      if (shown.length > room) shown = `...${shown.slice(shown.length - Math.max(room - 3, 1))}`;
      return `E1050 ${what} at ${shown}${REST}`;
    }
    return `E1050 ${what} at build time${REST}`;
  });
}
