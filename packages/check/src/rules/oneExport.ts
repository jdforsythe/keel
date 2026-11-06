import type { Program } from "oxc-parser";
import { clip } from "../internal/clip.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { stemOf } from "../internal/stemOf.ts";
import { str } from "../internal/str.ts";
import type { RuleDef } from "../types/RuleDef.ts";

type Exported = { name: string; at: number };

/** A route's server module (k.server) exports its `loader` and `action` side by side. */
/** A component file may also export its `Props` type and its `uses` declaration (k.component). */
const COMPONENT_EXTRAS: ReadonlySet<string> = new Set(["Props", "uses"]);

const SERVER_EXPORTS: ReadonlySet<string> = new Set(["loader", "action"]);

function exportsOf(ast: Program): Exported[] {
  const out: Exported[] = [];
  for (const s of ast.body) {
    if (s.type === "ExportAllDeclaration") out.push({ name: "*", at: s.start });
    else if (s.type === "ExportDefaultDeclaration") {
      const d = s.declaration;
      const id = (d.type === "FunctionDeclaration" || d.type === "ClassDeclaration") && d.id ? d.id.name : null;
      out.push({ name: id ?? (d.type === "Identifier" ? d.name : "default"), at: s.start });
    } else if (s.type === "TSExportAssignment") out.push({ name: "default", at: s.start });
    else if (s.type === "ExportNamedDeclaration") {
      const d = s.declaration;
      if (d === null) {
        for (const sp of s.specifiers) {
          const e = sp.exported;
          out.push({ name: e.type === "Literal" ? String(e.value) : e.name, at: s.start });
        }
      } else if (d.type === "VariableDeclaration") {
        for (const v of d.declarations) if (v.id.type === "Identifier") out.push({ name: v.id.name, at: s.start });
      } else if ("id" in d && d.id !== null && d.id.type === "Identifier") out.push({ name: d.id.name, at: s.start });
    }
  }
  return out;
}

/**
 * E1752 (principle 3): more than one export in a file, or a filename not equal to its export. A component
 * file (`.tsx`/`.jsx` with a default export) may also export `Props` and `uses` (k.component); a `*.server.ts` whose
 * exports are only `loader`/`action` is exempt (k.server). A `*.schema.ts` may export one schema plus its inferred type alias of the same name. Index files re-export.
 */
export const oneExport: RuleDef = {
  code: "E1752",
  message: (f) =>
    str(f.data, "kind") === "many"
      ? clip(`${str(f.data, "count")} exports in one file (${str(f.data, "names")}); one export per file`, 89)
      : clip(`file ${str(f.data, "stem")} exports ${str(f.data, "name")}; filename must equal its export`, 89),
  explain: "One export per file and the filename equals the export, so every symbol has one address.",
  see: "k.check",
  check: ({ file, ast }) => {
    const stem = stemOf(file.path);
    if (!isAppPath(file.path) || stem === "index") return [];
    const all = exportsOf(ast);
    const component = /\.[jt]sx$/.test(file.path) && ast.body.some((s) => s.type === "ExportDefaultDeclaration");
    const named = all.filter((e) => !(component && COMPONENT_EXTRAS.has(e.name)));
    if (/\.server\.[cm]?[jt]s$/.test(file.path) && named.every((e) => SERVER_EXPORTS.has(e.name))) return [];
    const names = [...new Set(named.map((e) => e.name))];
    if (names.length > 1) {
      const second = named.find((e) => e.name === names[1]) ?? named[1];
      const count = String(names.length);
      return [findingAt(file, second?.at ?? 0, { kind: "many", count, names: names.join(", ") })];
    }
    const only = named[0];
    if (only === undefined || only.name === "default" || only.name === "*" || only.name === stem) return [];
    return [findingAt(file, only.at, { kind: "name", stem, name: only.name })];
  },
};
