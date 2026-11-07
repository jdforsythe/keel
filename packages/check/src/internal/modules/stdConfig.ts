import { pathToString, s } from "@keel/schema";
import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { ModuleInfo } from "./ModuleInfo.ts";
import { moduleDiag } from "./moduleDiag.ts";
import { short } from "./short.ts";

const STD = /^@keel\/std-[^/]+$/;

/**
 * E1158 (k.module, RFC 0047) for one module's `std` entries: a key that is not a stdlib package in its `deps`, a value
 * that is not literal JSON, or a value failing the schema its package registered under its name (`s.register(pkg, ...)`;
 * a package that registers none is not validated further). No fix: whether to add the dep or drop the entry is a choice.
 */
export function stdConfig(m: ModuleInfo): Diagnostic[] {
  const man = m.manifest;
  if (man === null) return [];
  const deps = new Set(man.deps.entries.map((e) => e.value));
  const registry = s.registry();
  const out: Diagnostic[] = [];
  const own = short(m.key);
  for (const e of man.std) {
    const k = short(e.key);
    if (!STD.test(e.key) || !deps.has(e.key)) {
      out.push(moduleDiag("E1158", m.file, e.start, `std key ${k} is not a stdlib package in deps of module ${own}`));
      continue;
    }
    if (e.value === undefined) {
      out.push(moduleDiag("E1158", m.file, e.start, `std config for ${k} in module ${own} is not literal JSON`));
      continue;
    }
    const parsed = registry.get(e.key)?.parse(e.value);
    if (parsed === undefined || parsed.ok) continue;
    const issue = parsed.error.data.issues[0];
    const at = issue === undefined ? "." : pathToString(issue.path) || ".";
    const rule = issue === undefined ? "type" : issue.rule;
    out.push(moduleDiag("E1158", m.file, e.start, `std config for ${k} fails its schema at ${short(at)} (${rule})`));
  }
  return out;
}
