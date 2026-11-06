import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { Analysis } from "../Analysis.ts";
import type { Edit } from "../Edit.ts";
import { bindsTo } from "../bindsTo.ts";
import { componentFns } from "../componentFns.ts";
import { diag } from "../diag.ts";
import { unifiedPatch } from "../unifiedPatch.ts";

/**
 * E1401: destructured props lose reactivity (props are getters). Simple patterns (`{ a, b: c }`) are
 * rewritten to `props.a` reads in the output (scope-aware: reads bound by an inner declaration of the
 * same name are left alone), and the same edits are the diagnostic's fix as a unified patch.
 */
export function rulePropsDestructuring(a: Analysis): { diagnostics: Diagnostic[]; edits: Edit[] } {
  const diagnostics: Diagnostic[] = [];
  const edits: Edit[] = [];
  for (const f of componentFns(a)) {
    const p = f.node.params[0];
    if (p === undefined || p.type !== "ObjectPattern") continue;
    const locals = new Map<string, string>();
    let simple = true;
    for (const prop of p.properties) {
      if (
        prop.type !== "Property" ||
        prop.computed ||
        prop.key.type !== "Identifier" ||
        prop.value.type !== "Identifier"
      ) {
        simple = false;
        continue;
      }
      locals.set(prop.value.name, prop.key.name);
    }
    const name = (f.name ?? a.stem).slice(0, 30);
    const first = [...locals.values()][0] ?? "x";
    const message = `props destructured in ${name}; read props.${first.slice(0, 20)} instead`;
    const body = f.node.body;
    if (!simple || body === null) {
      diagnostics.push(diag(a, "E1401", p.start, message, "k.component"));
      continue;
    }
    const scope = { start: f.start, end: f.end };
    const mine: Edit[] = [{ start: p.start, end: p.typeAnnotation ? p.typeAnnotation.start : p.end, text: "props" }];
    for (const [local, key] of locals) {
      for (const r of a.identsByName.get(local) ?? []) {
        if (r.start < body.start || r.end > body.end || !bindsTo(a, local, r.start, scope)) continue;
        mine.push({ start: r.start, end: r.end, text: r.shorthand ? `${local}: props.${key}` : `props.${key}` });
      }
    }
    edits.push(...mine);
    diagnostics.push(diag(a, "E1401", p.start, message, "k.component", unifiedPatch(a.path, a.source, mine)));
  }
  return { diagnostics, edits };
}
