import { type Program, parseSync } from "oxc-parser";

/** Parse one source file with oxc; null when it has syntax errors (codemods never edit what they cannot parse). */
export function parseSource(path: string, src: string): Program | null {
  const lang = /\.tsx$/.test(path) ? "tsx" : /\.[cm]?ts$/.test(path) ? "ts" : /\.jsx$/.test(path) ? "jsx" : "js";
  const r = parseSync(path, src, { sourceType: "module", lang });
  return r.errors.length > 0 ? null : r.program;
}
