import type { JSXElement } from "oxc-parser";
import type { Analysis } from "./Analysis.ts";
import type { ElementInfo } from "./ElementInfo.ts";
import { attrOf } from "./attrOf.ts";
import { componentAt } from "./componentAt.ts";
import { decodeEntities } from "./decodeEntities.ts";
import { isHtmlTag } from "./isHtmlTag.ts";
import { lineCol } from "./lineCol.ts";
import { nameSourceOf } from "./nameSourceOf.ts";
import { roleOf } from "./roleOf.ts";
import { staticValueOf } from "./staticValueOf.ts";
import { tagNameOf } from "./tagNameOf.ts";

function literal(el: JSXElement, name: string): string | undefined {
  const v = staticValueOf(attrOf(el, name)?.value ?? null);
  if (v === undefined || v.bare || v.text === "") return undefined;
  return v.encoded ? decodeEntities(v.text) : v.text;
}

/**
 * Every intrinsic element in source order with its stable id: the literal `id` attribute when present,
 * else `<file stem>.<ordinal>` where the ordinal counts all intrinsic elements of the file from 0.
 */
export function collectElements(a: Analysis): ElementInfo[] {
  const els = a.jsx.filter(
    (j): j is JSXElement => j.type === "JSXElement" && isHtmlTag(tagNameOf(j.openingElement.name)),
  );
  const labels = els.filter((e) => tagNameOf(e.openingElement.name) === "label");
  const labelFor = new Set<string>();
  for (const l of labels) {
    const f = literal(l, "for") ?? literal(l, "htmlFor");
    if (f !== undefined) labelFor.add(f);
  }
  return els.map((el, index) => {
    const tag = tagNameOf(el.openingElement.name);
    const explicit = literal(el, "id");
    const id = explicit ?? `${a.stem}.${index}`;
    const labelled = labelFor.has(id) || labels.some((l) => l !== el && l.start < el.start && el.end <= l.end);
    const { line, col } = lineCol(a.source, el.start);
    const role = roleOf(el, tag);
    return {
      id,
      explicit: explicit !== undefined,
      start: el.start,
      file: a.path,
      line,
      col,
      component: componentAt(a, el.start)?.name ?? a.stem,
      tag,
      role,
      name: nameSourceOf(el, tag, role, labelled),
    };
  });
}
