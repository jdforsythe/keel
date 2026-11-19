import { type Program, parseSync } from "oxc-parser";

/** Parses TS source (`.tsx` as TSX); undefined on a syntax error. */
export function parseTs(path: string, source: string): Program | undefined {
  const r = parseSync(path, source, { sourceType: "module", lang: path.endsWith("x") ? "tsx" : "ts" });
  return r.errors.length > 0 ? undefined : r.program;
}
