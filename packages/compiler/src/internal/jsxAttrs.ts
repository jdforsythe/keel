import type { JSXElement } from "oxc-parser";
import type { AttrLookup } from "../a11y/AttrLookup.ts";
import { attrOf } from "./attrOf.ts";
import { decodeEntities } from "./decodeEntities.ts";
import { staticValueOf } from "./staticValueOf.ts";

/**
 * A JSX element's attributes for `roleFor`: the decoded literal value (`""` when bare), `null` when absent,
 * `undefined` when the value is an expression, or when absent but a spread attribute could supply it.
 */
export function jsxAttrs(el: JSXElement): AttrLookup {
  const spread = el.openingElement.attributes.some((at) => at.type === "JSXSpreadAttribute");
  return (name) => {
    const at = attrOf(el, name);
    if (at === undefined) return spread ? undefined : null;
    const v = staticValueOf(at.value);
    if (v === undefined) return undefined;
    return v.encoded ? decodeEntities(v.text) : v.text;
  };
}
