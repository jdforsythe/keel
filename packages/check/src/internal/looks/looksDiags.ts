import { tokenGroups } from "@keel/ui";
import { type ObjectExpression, Visitor } from "oxc-parser";
import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { SourceFile } from "../../types/SourceFile.ts";
import { applyEdits } from "../applyEdits.ts";
import { keyName } from "../keyName.ts";
import { moduleDiag } from "../modules/moduleDiag.ts";
import { parseFile } from "../parseFile.ts";
import { unifiedDiff } from "../unifiedDiff.ts";
import type { LookLibrary } from "./LookLibrary.ts";
import type { Looks } from "./Looks.ts";
import { e1810Edits } from "./e1810Edits.ts";
import { e1810ThemeEdits } from "./e1810ThemeEdits.ts";
import { entryProblems } from "./entryProblems.ts";
import { themeGaps } from "./themeGaps.ts";
import { tokensInit } from "./tokensInit.ts";

type Rec = Readonly<Record<string, unknown>>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const SEE = "k.looks";

/**
 * The k.looks project pass over `looks` (real paths): E1812 for each library's `./tokens` entry and shipped file,
 * read as text and judged whatever the project's tokens; then, over `tokens` (the evaluated `tokens` export the
 * project is given; with a `tokens.ts` and none given, nothing more is judged; with no `tokens.ts`, no tokens), E1810
 * once per listed library whose needs the tokens miss (at `tokens` in `tokens.ts`, with its fix; with no `tokens.ts`
 * at each `deps` entry naming it, no fix), and E1813 for each dotted name no listed library ships and, in a library's
 * own folder, each key the fixture writes over the library's defaults. `tokens.ts`'s text gives positions and the fix.
 */
export function looksDiags(
  looks: Looks,
  files: readonly SourceFile[],
  tokens: { readonly given: boolean; readonly value: unknown },
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const byPath = new Map(files.map((f) => [f.path, f]));
  for (const lib of looks.libraries) {
    const pkg = byPath.get(lib.packagePath);
    if (lib.entry === "wrong" && pkg !== undefined)
      out.push(
        moduleDiag("E1812", pkg, lib.exportsAt, `./tokens keel target is not ./src/${lib.id}Tokens.ts`, undefined, SEE),
      );
    const shipped = byPath.get(lib.shippedPath);
    const problem = lib.shipped?.problem;
    if (shipped !== undefined && problem !== undefined && problem !== null)
      out.push(moduleDiag("E1812", shipped, problem.at, problem.message, undefined, SEE));
  }
  // E1815: an entry's `keel` other than first, at each `deps` entry naming the library, judged whatever the tokens.
  for (const lib of looks.listed) {
    if (lib.own) continue;
    const pkg = byPath.get(lib.packagePath);
    let parsed: unknown;
    try {
      parsed = JSON.parse(pkg?.source ?? "");
    } catch {
      continue;
    }
    const exists = (rel: string): boolean => byPath.has(`${lib.folder}${rel}`);
    for (const [key, what] of entryProblems(parsed, exists, importedSubpaths(files, lib.name)))
      for (const { path, entry } of looks.entries.get(lib.name) ?? []) {
        const file = byPath.get(path);
        const message = key === undefined ? `${lib.name} ${what}` : `${lib.name} exports "${key}" ${what}`;
        if (file !== undefined) out.push(moduleDiag("E1815", file, entry.start, message, undefined, SEE));
      }
  }
  const tokensFile = files.find((f) => f.path.replace(/^\.\//, "") === `${looks.dir}tokens.ts`);
  if (tokensFile !== undefined && !tokens.given) return out;
  const value: Rec = tokensFile !== undefined && isRec(tokens.value) ? tokens.value : {};
  const parsed = tokensFile === undefined ? undefined : parseFile(tokensFile);
  const program = parsed?.ok === true ? parsed.program : undefined;
  const found = program === undefined ? undefined : tokensInit(program);
  const imported = new Set<string>();
  for (const st of program?.body ?? [])
    if (st.type === "ImportDeclaration")
      for (const sp of st.specifiers) if (sp.type === "ImportSpecifier") imported.add(sp.local.name);
  const holds = (group: string, name: string): boolean => {
    const g = value[group];
    return isRec(g) && Object.hasOwn(g, name);
  };
  const shippedGroups = (spec: string): ReadonlySet<string> | undefined => {
    const lib = looks.libraries.find((l) => `${l.name}/tokens` === spec);
    return lib?.shipped === null || lib === undefined ? undefined : new Set(lib.shipped.names.keys());
  };
  // E1810: one per listed library whose shipped names the tokens miss.
  for (const lib of looks.listed) {
    if (lib.entry !== "ok" || lib.shipped === null) continue;
    const missing: [string, string][] = [];
    for (const [group, names] of lib.shipped.names)
      for (const n of names) if (!holds(group, n)) missing.push([group, n]);
    const [first] = missing;
    if (first === undefined) continue;
    const [group, token] = first;
    const more = missing.length > 1 ? ` and ${missing.length - 1} more` : "";
    const local = `${lib.id}Tokens`;
    const tail = imported.has(local) ? `; spread ${local}.${group}` : `; import ${local} from ${lib.name}/tokens`;
    const message = `${lib.name} needs ${group} "${token}"${more}${tail}`;
    if (tokensFile === undefined) {
      for (const { path, entry } of looks.entries.get(lib.name) ?? []) {
        const file = byPath.get(path);
        if (file !== undefined) out.push(moduleDiag("E1810", file, entry.start, message, undefined, SEE));
      }
      continue;
    }
    const edits = program === undefined ? null : e1810Edits(tokensFile.source, program, lib, shippedGroups);
    const fix =
      edits === null
        ? undefined
        : unifiedDiff(tokensFile.path, tokensFile.source, applyEdits(tokensFile.source, edits));
    out.push(moduleDiag("E1810", tokensFile, found?.name ?? 0, message, fix, SEE));
  }
  // E1810 for themes: the app's `contrast` and `print` themes hold the names the shipped ones hold.
  for (const lib of looks.listed) {
    if (lib.entry !== "ok" || lib.shipped === null) continue;
    const local = `${lib.id}Tokens`;
    for (const gap of themeGaps(lib.shipped, value.themes)) {
      const [first] = gap.missing;
      if (first === undefined) continue;
      const [group, token] = first;
      const more = gap.missing.length > 1 ? ` and ${gap.missing.length - 1} more` : "";
      const spread = `${local}.themes.${gap.key}.${group}`;
      const message = `${lib.name} needs themes.${gap.theme} ${group} "${token}"${more}; spread ${spread}`;
      if (tokensFile === undefined) {
        for (const { path, entry } of looks.entries.get(lib.name) ?? []) {
          const file = byPath.get(path);
          if (file !== undefined) out.push(moduleDiag("E1810", file, entry.start, message, undefined, SEE));
        }
        continue;
      }
      const edits = program === undefined ? null : e1810ThemeEdits(tokensFile.source, program, lib, gap);
      const fix =
        edits === null
          ? undefined
          : unifiedDiff(tokensFile.path, tokensFile.source, applyEdits(tokensFile.source, edits));
      out.push(moduleDiag("E1810", tokensFile, found?.name ?? 0, message, fix, SEE));
    }
  }
  if (tokensFile === undefined) return out;
  // E1813: in a library's own folder, each key the fixture writes over its defaults.
  const own = looks.own;
  const overridden = new Set<string>();
  const literal = found?.init.type === "CallExpression" ? found.init.arguments[0] : undefined;
  if (own !== undefined && literal?.type === "ObjectExpression")
    for (const p of literal.properties) {
      const group = p.type === "Property" ? keyName(p) : null;
      if (p.type !== "Property" || group === null || p.value.type !== "ObjectExpression") continue;
      for (const [name, at] of ownKeys(p.value, own))
        if (!overridden.has(`${group}\u0000${name}`)) {
          overridden.add(`${group}\u0000${name}`);
          out.push(
            moduleDiag(
              "E1813",
              tokensFile,
              at,
              `${group} "${name}": the fixture overrides ${own.id}'s default`,
              undefined,
              SEE,
            ),
          );
        }
    }
  // E1813: each dotted name of the tokens that no listed library ships.
  const literals = program === undefined ? new Map<string, number>() : stringLiterals(program);
  const unshipped = (group: string, name: string): string | undefined => {
    const dot = name.indexOf(".");
    if (dot < 0 || overridden.has(`${group}\u0000${name}`)) return undefined;
    const id = name.slice(0, dot);
    const lib = looks.listed.find((l) => l.id === id);
    if (lib !== undefined && ships(lib, group, name)) return undefined;
    return lib === undefined
      ? `${group} "${name}": no library the app lists has id ${id}`
      : `${group} "${name}": ${lib.name} ships no such token`;
  };
  const reported = new Set<string>();
  for (const group of [...tokenGroups, "look"]) {
    const g = value[group];
    if (!isRec(g)) continue;
    for (const name of Object.keys(g)) {
      const bad = unshipped(group, name);
      if (bad !== undefined) out.push(moduleDiag("E1813", tokensFile, literals.get(name) ?? 0, bad, undefined, SEE));
    }
  }
  // E1813 in a theme: each dotted name of a theme's groups, as a top-level key is judged.
  const themes = value.themes;
  for (const theme of isRec(themes) ? Object.values(themes) : [])
    for (const group of isRec(theme) ? tokenGroups : []) {
      const g = isRec(theme) ? theme[group] : undefined;
      if (!isRec(g)) continue;
      for (const name of Object.keys(g)) {
        const bad = unshipped(group, name);
        if (bad === undefined || reported.has(`${group}\u0000${name}`)) continue;
        reported.add(`${group}\u0000${name}`);
        out.push(moduleDiag("E1813", tokensFile, literals.get(name) ?? 0, bad, undefined, SEE));
      }
    }
  return out;
}

/** The subpaths (`.`, `./tokens`) of `name` that the code files among `files` import, export from or load. */
function importedSubpaths(files: readonly SourceFile[], name: string): string[] {
  const out = new Set<string>();
  const quoted = name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const pattern = new RegExp(`(?:from|import|import\\()\\s*["'\`]${quoted}(/[^"'\`]*)?["'\`]`, "g");
  for (const f of files) {
    if (!/\.[cm]?[jt]sx?$/.test(f.path) || f.path.includes("node_modules/")) continue;
    for (const m of f.source.matchAll(pattern)) out.add(m[1] === undefined ? "." : `.${m[1]}`);
  }
  return [...out].sort();
}

/** Whether `lib`'s shipped object holds `name` in `group`. */
const ships = (lib: LookLibrary, group: string, name: string): boolean =>
  lib.shipped?.names.get(group)?.includes(name) === true;

/** The keys of a group object written as `<id>.<name>`, with the offset of each key. */
function ownKeys(o: ObjectExpression, own: LookLibrary): [string, number][] {
  const out: [string, number][] = [];
  for (const p of o.properties) {
    const k = p.type === "Property" ? keyName(p) : null;
    if (p.type === "Property" && k !== null && k.startsWith(`${own.id}.`)) out.push([k, p.key.start]);
  }
  return out;
}

/** The offset of the first string literal holding each value, in source order. */
function stringLiterals(program: Parameters<Visitor["visit"]>[0]): Map<string, number> {
  const out = new Map<string, number>();
  new Visitor({
    Literal: (n) => {
      if (typeof n.value === "string" && !out.has(n.value)) out.set(n.value, n.start);
    },
  }).visit(program);
  return out;
}
