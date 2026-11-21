import type { Result } from "@keel/schema";
import MagicString from "magic-string";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { ManifestChange } from "./ManifestChange.ts";
import type { Writes } from "./Writes.ts";
import { badInput } from "./badInput.ts";
import { commit } from "./commit.ts";
import { editManifest } from "./editManifest.ts";
import { fail } from "./fail.ts";
import { importRefs } from "./importRefs.ts";
import { inputs } from "./inputs.ts";
import { isCode } from "./isCode.ts";
import { isGenerated } from "./isGenerated.ts";
import { isLowerCamel } from "./isLowerCamel.ts";
import { joinSpec } from "./joinSpec.ts";
import { moduleOf } from "./moduleOf.ts";
import { parseSource } from "./parseSource.ts";
import { resolveImport } from "./resolveImport.ts";
import { restyleSpec } from "./restyleSpec.ts";
import { sortedKeys } from "./sortedKeys.ts";

const KINDS = ["", ".store", ".schema", ".server", ".transaction"];

/** The file a move names: `<name>.tsx`, `<name>.ts`, or `<name>.<kind>.ts`, anywhere in the tree. */
function candidates(files: ReadonlyMap<string, string>, name: string): string[] {
  const bases = new Set(KINDS.flatMap((k) => [`${name}${k}.ts`, `${name}${k}.tsx`]));
  return sortedKeys(files.keys()).filter((p) => bases.has(p.split("/").pop() ?? ""));
}

/** A contract file: importing it needs `deps` only, never `public.exports` (k.contract). */
const isContract = (p: string): boolean => p.endsWith(".contract.ts");

const stemOf = (p: string): string => (p.split("/").pop() ?? "").split(".")[0] ?? "";

/**
 * `codemod move <name> --to <module>`: relocate the file, rewrite its relative imports and every import
 * of it, and update both manifests: the moved export becomes public in the target when another module
 * imports it, importers gain the target in `deps`, and the target gains every module the file imports from.
 */
export function opMove(input: unknown, files: ReadonlyMap<string, string>): Result<Edit, ScaffoldError> {
  const r = inputs.move.parse(input);
  if (!r.ok) return badInput("move", r.error);
  const { name, to } = r.value;
  const found = candidates(files, name);
  const gen = found.find(isGenerated);
  if (gen !== undefined) return fail("E1005", gen, `${gen} is generated and read-only; it cannot be moved`);
  const src = found[0];
  if (src === undefined) return fail("E1052", name, `no file declares ${name}`);
  if (found.length > 1) return fail("E1052", name, `${name} is ambiguous: ${found.join(", ")}`);
  const from = moduleOf(src);
  if (from === null) return fail("E1052", src, `${src} is not in a module`);
  if (!isLowerCamel(to) || !files.has(`modules/${to}/module.ts`))
    return fail("E1352", `modules/${to}`, `${to} is not a module of this project`);
  if (from === to) return fail("E1351", src, `${name} is already in module ${to}`);
  const dest = `modules/${to}/${src.slice(`modules/${from}/`.length)}`;
  if (files.has(dest)) return fail("E1351", dest, `${dest} already exists`);

  const changes = new Map<string, ManifestChange>();
  const change = (mod: string): ManifestChange => {
    const c = changes.get(mod) ?? { addDeps: new Set(), addExports: new Set(), removeExports: new Set() };
    changes.set(mod, c);
    return c;
  };
  change(from).removeExports.add(stemOf(src));
  const writes: Writes = new Map();
  for (const path of sortedKeys(files.keys())) {
    const text = files.get(path);
    if (text === undefined || !isCode(path) || isGenerated(path)) continue;
    const program = parseSource(path, text);
    if (program === null) continue;
    const self = path === src;
    const at = self ? dest : path;
    const mine = moduleOf(at);
    const ms = new MagicString(text);
    for (const ref of importRefs(program)) {
      if (!ref.spec.startsWith(".")) continue;
      const target = resolveImport(files, path, ref.spec);
      if (self) {
        const t = target ?? joinSpec(path, ref.spec);
        const next = restyleSpec(ref.spec, t, dest, t);
        if (next !== ref.spec) ms.overwrite(ref.start + 1, ref.end - 1, next);
        const tm = moduleOf(t);
        if (target !== null && tm !== null && tm !== to) {
          change(to).addDeps.add(tm);
          if (!isContract(t)) change(tm).addExports.add(stemOf(t));
        }
      } else if (target === src) {
        ms.overwrite(ref.start + 1, ref.end - 1, restyleSpec(ref.spec, src, path, dest));
        if (mine !== null && mine !== to) {
          change(to).addExports.add(stemOf(src));
          change(mine).addDeps.add(to);
        }
      }
    }
    const out = ms.toString();
    if (self) {
      writes.set(src, null);
      writes.set(dest, out);
    } else if (out !== text) writes.set(path, out);
  }
  for (const mod of sortedKeys(changes.keys())) {
    const p = `modules/${mod}/module.ts`;
    const text = writes.get(p) ?? files.get(p);
    const c = changes.get(mod);
    if (typeof text === "string" && c !== undefined) writes.set(p, editManifest(p, text, c));
  }
  return commit(files, writes);
}
