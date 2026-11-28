import fs from "node:fs";
import path from "node:path";

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

/**
 * The line of `file`'s own text that the bundler's `line` (1-based, in the text it was given) shows as `lineText`:
 * the nearest at or above it holding that text, since compiling an app file may put lines before its own; `line`
 * itself when no line of the file holds it or the file cannot be read.
 */
function sourceLine(file: string, line: number, lineText: string): number {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return line;
  }
  const lines = text.split("\n");
  for (let i = Math.min(line, lines.length) - 1; i >= 0; i--) if (lines[i] === lineText) return i + 1;
  return line;
}

/**
 * A bundling failure of a build-time evaluation (k.compiler Build-time evaluation) as an `Error` whose message is
 * `Build failed with 1 error:` and then `<path>:<line>:<col>: ERROR: <text>` for its first error, the path as the
 * bundler names it from `root` and the line that of the file's own text (`sourceLine`), the column 0-based as the
 * bundler gives it; the failure itself when it carries no located error.
 */
export function bundleFailure(e: unknown, root: string): unknown {
  const errors: unknown = isRecord(e) || e instanceof Error ? Reflect.get(e, "errors") : undefined;
  const first: unknown = Array.isArray(errors) ? errors[0] : undefined;
  const at: unknown = isRecord(first) ? first.location : undefined;
  if (!isRecord(first) || !isRecord(at) || typeof first.text !== "string") return e;
  const { file, line, column, lineText } = at;
  if (typeof file !== "string" || typeof line !== "number" || typeof column !== "number") return e;
  const own = typeof lineText === "string" ? sourceLine(path.resolve(root, file), line, lineText) : line;
  return new Error(`Build failed with 1 error:\n${file}:${String(own)}:${String(column)}: ERROR: ${first.text}`, {
    cause: e,
  });
}
