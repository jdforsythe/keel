import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { Analysis } from "../Analysis.ts";
import type { Edit } from "../Edit.ts";
import { applyEdits } from "../applyEdits.ts";
import { componentFns } from "../componentFns.ts";
import { diag } from "../diag.ts";

function hunk(source: string, edits: Edit[]): string {
  const lo = Math.min(...edits.map((e) => e.start));
  const hi = Math.max(...edits.map((e) => e.end));
  const from = source.lastIndexOf("\n", lo - 1) + 1;
  const nl = source.indexOf("\n", hi);
  const to = nl < 0 ? source.length : nl;
  const before = source.slice(from, to).split("\n");
  const after = applyEdits(source, from, to, edits).split("\n");
  return [...before.map((l) => `-${l}`), ...after.map((l) => `+${l}`)].join("\n");
}

/**
 * E1401: destructured props lose reactivity (props are getters). Simple patterns (`{ a, b: c }`) are
 * rewritten to `props.a` reads in the output, and the same rewrite is the diagnostic's fix.
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
    const mine: Edit[] = [{ start: p.start, end: p.typeAnnotation ? p.typeAnnotation.start : p.end, text: "props" }];
    for (const r of a.idents) {
      if (r.start < body.start || r.end > body.end) continue;
      const key = locals.get(r.name);
      if (key === undefined) continue;
      mine.push({ start: r.start, end: r.end, text: r.shorthand ? `${r.name}: props.${key}` : `props.${key}` });
    }
    edits.push(...mine);
    diagnostics.push(diag(a, "E1401", p.start, message, "k.component", hunk(a.source, mine)));
  }
  return { diagnostics, edits };
}
