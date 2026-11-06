import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { Analysis } from "../Analysis.ts";
import { RAW_HTML } from "../RAW_HTML.ts";
import { attrNameOf } from "../attrNameOf.ts";
import { diag } from "../diag.ts";

/** E1002: raw HTML sinks as JSX attributes or member accesses. */
export function ruleRawHtml(a: Analysis): Diagnostic[] {
  const out: Diagnostic[] = [];
  const hit = (name: string, at: number): void => {
    out.push(diag(a, "E1002", at, `raw HTML via ${name}; render text or elements instead`, "k.compiler"));
  };
  for (const j of a.jsx) {
    if (j.type !== "JSXElement") continue;
    for (const at of j.openingElement.attributes) {
      if (at.type !== "JSXAttribute") continue;
      const name = attrNameOf(at.name);
      if (RAW_HTML.has(name)) hit(name, at.start);
    }
  }
  for (const m of a.members) if (RAW_HTML.has(m.name)) hit(m.name, m.start);
  return out;
}
