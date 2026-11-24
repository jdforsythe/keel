import { s } from "@keel/schema";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { FormatSite } from "./FormatSite.ts";
import { lineCol } from "./lineCol.ts";

/**
 * E1108 (k.formats) at one `formatLiteral` call: its `format` names no one registered format, its `text` is no string
 * literal, or the registered format's `parse` refuses it. The registry is the process's: `keel check` imports the
 * `@keel/std-*` packages in `deps` first, and no app code runs.
 */
export function judgeFormat(site: FormatSite, source: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const at = (pos: number, message: string): void => {
    if (pos >= 0)
      out.push({ kind: "diag", code: "E1108", path: site.path, ...lineCol(source, pos), message, see: "k.formats" });
  };
  const name = site.names.length === 1 ? site.names[0] : undefined;
  const schema = name === undefined ? undefined : s.registry().get(name);
  if (schema === undefined)
    at(
      site.formatAt,
      site.names.length === 0
        ? "formatLiteral format is no format type over a string"
        : `formatLiteral format ${site.names.join(" & ")} is not one registered format; list its package in \`deps\` (only a stdlib format has a literal form)`,
    );
  if (site.text === null) at(site.textAt, "formatLiteral text is not a string literal");
  else if (schema !== undefined) {
    const r = schema.parse(site.text);
    if (!r.ok)
      at(site.textAt, `formatLiteral text does not parse as ${name} (${r.error.data.issues[0]?.rule ?? "type"})`);
  }
  return out;
}
