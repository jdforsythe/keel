import type { JSXElement } from "oxc-parser";
import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { Analysis } from "../Analysis.ts";
import { attrOf } from "../attrOf.ts";
import { componentAt } from "../componentAt.ts";
import { diag } from "../diag.ts";
import { exprOf } from "../exprOf.ts";
import { intrinsicOf } from "../intrinsicOf.ts";
import { propsNameOf } from "../propsNameOf.ts";
import { shapeAt } from "../shapeAt.ts";
import { staticValueOf } from "../staticValueOf.ts";

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 3)}...` : s);

function forKey(a: Analysis, el: JSXElement): Diagnostic[] {
  const keyAttr = attrOf(el, "key");
  const key = keyAttr === undefined ? undefined : staticValueOf(keyAttr.value);
  if (key === undefined || key.bare || key.text === "")
    return [diag(a, "E1001", el.start, 'For needs key="<field>" naming a field of the item', "k.compiler")];
  const each = exprOf(attrOf(el, "each"));
  if (each === undefined) return [];
  const s = shapeAt(a, each, propsNameOf(componentAt(a, el.start)));
  if (s.kind !== "array" || s.item.kind !== "object" || s.item.fields.has(key.text)) return [];
  const fields = clip([...s.item.fields.keys()].join(", "), 30);
  return [
    diag(
      a,
      "E1001",
      keyAttr?.start ?? el.start,
      `For key "${clip(key.text, 20)}" is not a field of the item (${fields})`,
      "k.compiler",
    ),
  ];
}

function matchCases(a: Analysis, el: JSXElement): Diagnostic[] {
  const on = exprOf(attrOf(el, "on"));
  if (on === undefined) return [];
  const s = shapeAt(a, on, propsNameOf(componentAt(a, el.start)));
  if (s.kind !== "union") return [];
  const seen = new Set<string>();
  for (const c of el.children) {
    if (c.type !== "JSXElement" || intrinsicOf(a, c) !== "Case") continue;
    const tag = staticValueOf(attrOf(c, "tag")?.value ?? null);
    if (tag !== undefined && !tag.bare) seen.add(tag.text);
  }
  const missing = s.tags.filter((t) => !seen.has(t));
  if (missing.length === 0) return [];
  return [
    diag(a, "E1402", el.start, `Match on ${s.key} has no Case for: ${clip(missing.join(", "), 50)}`, "k.component"),
  ];
}

/** E1001 (`For` key) and E1402 (`Match` exhaustiveness), resolved against the file's `Props` schema. */
export function ruleControlFlow(a: Analysis): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const j of a.jsx) {
    if (j.type !== "JSXElement") continue;
    const kind = intrinsicOf(a, j);
    if (kind === "For") out.push(...forKey(a, j));
    else if (kind === "Match") out.push(...matchCases(a, j));
  }
  return out;
}
