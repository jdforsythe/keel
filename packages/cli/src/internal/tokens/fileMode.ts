import { basename } from "node:path";

/** The collection `stem` and `mode` a design tokens file's name gives: `<stem>.<mode>.tokens.json`, or any other name with no mode. */
export function fileMode(path: string): { stem: string; mode: string | undefined } {
  const base = basename(path);
  const m = /^(.+)\.([^.]+)\.tokens\.json$/.exec(base);
  if (m?.[1] !== undefined && m[2] !== undefined) return { stem: m[1], mode: m[2] };
  return { stem: base.replace(/(?:\.tokens)?\.json$/, ""), mode: undefined };
}
