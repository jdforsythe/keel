import fs from "node:fs";
import { SourceMap, type SourceMapPayload } from "node:module";
import path from "node:path";

/** `E1050 <what>`, NUL, the bundle positions of the refused call's frames, NUL, the rest (`OBSERVE_BANNER`). */
const MARKED = /^E1050 ([^\0]*)\0([^\0]*)\0 at build time(.*)$/s;
const MARK = /\0[^\0]*\0/g;
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
 * Each E1050 problem of an evaluation (k.compiler Rules) placed at the first frame of the refused call inside the
 * project or a package, mapped through the bundle's source map (`map`, read only when one is marked): a project file's
 * frame is the problem's position (`E1050 <path>:<line>:<col> <what> ...`), a package's is named in its message
 * (`<what> at <package>/<path>:<line>: ...`, the file cut from its start with `...` when the two do not fit in 86
 * units); with no such frame the message is `<what> at build time: ...`. The marks are taken out of every other
 * problem, one whose code wrapped a refusal's message included.
 */
export function placeRefusals(problems: readonly string[], map: () => string | undefined, root: string): string[] {
  let source: SourceMap | undefined;
  const sourceMap = (): SourceMap | undefined => {
    if (source !== undefined) return source;
    const text = map();
    const v: unknown = text === undefined ? undefined : JSON.parse(text);
    if (isPayload(v)) source = new SourceMap(v);
    return source;
  };
  return problems.map((p) => {
    const m = MARKED.exec(p);
    if (m === null) return p.replace(MARK, "");
    const [, what = "", at = "", rest = ""] = m;
    const sm = at === "" ? undefined : sourceMap();
    for (const pos of at.split(" ")) {
      const [line = 0, col = 0] = pos.split(":").map(Number);
      const e = sm?.findEntry(line - 1, col - 1);
      if (e === undefined || !("originalSource" in e)) continue;
      const file = e.originalSource;
      if (file.includes("<") || file.endsWith("keel-evaluate.js")) continue;
      const abs = path.resolve(root, file.startsWith("file:") ? new URL(file).pathname : file);
      const rel = path.relative(root, abs).split(path.sep).join("/");
      const ownLine = e.originalLine + 1;
      if (!rel.startsWith("../") && !path.isAbsolute(rel) && !rel.split("/").includes("node_modules"))
        return `E1050 ${rel}:${ownLine}:${e.originalColumn + 1} ${what} at build time${rest}`;
      let shown = `${packagePath(abs)}:${ownLine}`;
      const room = KEPT - what.length - " at ".length;
      if (shown.length > room) shown = `...${shown.slice(shown.length - Math.max(room - 3, 1))}`;
      return `E1050 ${what} at ${shown}${rest}`;
    }
    return `E1050 ${what} at build time${rest}`;
  });
}
