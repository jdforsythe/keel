import type { JSXElement } from "oxc-parser";
import { roleFor } from "../a11y/roleFor.ts";
import type { Analysis } from "./Analysis.ts";
import type { ElementInfo } from "./ElementInfo.ts";
import { attrOf } from "./attrOf.ts";
import { componentAt } from "./componentAt.ts";
import { decodeEntities } from "./decodeEntities.ts";
import { isHtmlTag } from "./isHtmlTag.ts";
import { jsxAttrs } from "./jsxAttrs.ts";
import { lineCol } from "./lineCol.ts";
import { nameSourceOf } from "./nameSourceOf.ts";
import { roleOf } from "./roleOf.ts";
import { staticValueOf } from "./staticValueOf.ts";
import { tagNameOf } from "./tagNameOf.ts";
import { uiBaseElements } from "./uiBaseElements.ts";

function literal(el: JSXElement, name: string): string | undefined {
  const v = staticValueOf(attrOf(el, name)?.value ?? null);
  if (v === undefined || v.bare || v.text === "") return undefined;
  return v.encoded ? decodeEntities(v.text) : v.text;
}

/** DOM tag, role and accessible-name source a base element renders (k.ui Base elements). */
function baseShape(el: JSXElement, base: string): { tag: string; role: string | null; name: ElementInfo["name"] } {
  const has = (n: string): boolean => attrOf(el, n) !== undefined;
  switch (base) {
    case "Box":
    case "Text": {
      const tag = literal(el, "as") ?? (base === "Box" ? "div" : "span");
      // A `label` is written as `aria-label` (k.ui): it names the element and makes a `section` a `region`.
      if (has("label")) {
        const attr = jsxAttrs(el);
        const role = roleFor(tag, (n) => attr(n === "aria-label" ? "label" : n)) ?? null;
        return { tag, role, name: "aria" };
      }
      const role = roleOf(el, tag);
      return { tag, role, name: nameSourceOf(el, tag, role, false) };
    }
    case "Heading":
      return { tag: `h${literal(el, "level") ?? "2"}`, role: "heading", name: "text" };
    case "Button":
      return { tag: "button", role: "button", name: has("label") && el.children.length > 0 ? "aria" : "text" };
    case "Link":
      return { tag: "a", role: "link", name: "text" };
    case "Image":
      return has("decorative")
        ? { tag: "img", role: "presentation", name: "none" }
        : { tag: "img", role: "img", name: "alt" };
    case "Input":
      return { tag: "input", role: "textbox", name: "label" };
    case "TextArea":
      return { tag: "textarea", role: "textbox", name: "label" };
    case "Select":
      return { tag: "select", role: "combobox", name: "label" };
    case "Host":
      // An empty `div` with its `role` (`img` unless `group` is written) and an ARIA name (k.host-element).
      return { tag: "div", role: literal(el, "role") ?? "img", name: "aria" };
    default:
      return { tag: "input", role: "checkbox", name: "label" };
  }
}

/**
 * Every intrinsic element in source order with its stable id: the literal `id` attribute when present,
 * else `<file>.<ordinal>`: `<file>` is the root-relative path without extension with `/` as `.`
 * (`src/cart/Add.tsx` -> `src.cart.Add`), the ordinal counts all intrinsic elements of the file from 0.
 * Then every `@keel/ui` base element with a literal `id` (they render it; no derived ids, no ordinals).
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
  const intrinsic = els.map((el, index): ElementInfo => {
    const tag = tagNameOf(el.openingElement.name);
    const explicit = literal(el, "id");
    const id = explicit ?? `${a.idPrefix}.${index}`;
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
      base: false,
    };
  });
  const ui = uiBaseElements(a);
  const based: ElementInfo[] = [];
  for (const j of a.jsx) {
    if (j.type !== "JSXElement") continue;
    const kind = ui.get(tagNameOf(j.openingElement.name));
    const id = literal(j, "id");
    if (kind === undefined || id === undefined) continue;
    const { line, col } = lineCol(a.source, j.start);
    const shape = baseShape(j, kind);
    based.push({
      id,
      explicit: true,
      base: true,
      start: j.start,
      file: a.path,
      line,
      col,
      component: componentAt(a, j.start)?.name ?? a.stem,
      ...shape,
    });
  }
  return [...intrinsic, ...based];
}
