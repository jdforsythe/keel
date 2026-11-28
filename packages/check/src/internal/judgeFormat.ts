import { s } from "@keel/schema";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { FormatSite } from "./FormatSite.ts";
import { depsFix } from "./depsFix.ts";
import { lineCol } from "./lineCol.ts";

const STD = /^@keel\/std-/;

/**
 * E1108 (k.formats) at one `formatLiteral` call: its `format` names no one registered format, its declaring package
 * cannot be told, its `text` is no string literal, or the registered format's `parse` refuses it. The registry is the
 * process's (`keel check` imports the `@keel/std-*` packages in `deps` first, and no app code runs), and it is
 * consulted only when the declaring package is a `@keel/std-*` package in `scope` (`stdInScope`); any other owner (a
 * kernel package, the app) names no registered format, so the answer depends on `deps` alone, as in a fresh process.
 * A format that is not registered and whose `@keel/std-*` package the module's `deps` do not list carries the fix that
 * lists it (`depsFix`). `files`: the checked files' texts by path.
 */
export function judgeFormat(
  site: FormatSite,
  files: ReadonlyMap<string, string>,
  scope: ReadonlySet<string>,
): Diagnostic[] {
  const source = files.get(site.path) ?? "";
  const out: Diagnostic[] = [];
  const at = (pos: number, message: string, fix = ""): void => {
    if (pos >= 0)
      out.push({
        kind: "diag",
        code: "E1108",
        path: site.path,
        ...lineCol(source, pos),
        message,
        see: "k.formats",
        ...(fix === "" ? {} : { fix }),
      });
  };
  const name = site.names.length === 1 ? site.names[0] : undefined;
  const consulted = site.owner !== null && STD.test(site.owner) && scope.has(site.owner);
  const schema = name === undefined || !consulted ? undefined : s.registry().get(name);
  if (schema === undefined)
    at(
      site.formatAt,
      site.names.length === 0
        ? "formatLiteral format is no format type over a string"
        : site.owner === null
          ? "formatLiteral format's package cannot be told; write the format as its import"
          : `formatLiteral format ${site.names.join(" & ")} is not one registered format`,
      site.names.length === 0 || site.owner === null ? "" : depsFix(site.path, site.pkg, files),
    );
  if (site.text === null) at(site.textAt, "formatLiteral text is not a string literal");
  else if (schema !== undefined) {
    const r = schema.parse(site.text);
    if (!r.ok)
      at(site.textAt, `formatLiteral text does not parse as ${name} (${r.error.data.issues[0]?.rule ?? "type"})`);
  }
  return out;
}
