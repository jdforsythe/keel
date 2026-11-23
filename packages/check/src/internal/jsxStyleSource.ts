import type { JSXAttributeItem } from "oxc-parser";
import type { StyleProp } from "./StyleProp.ts";
import type { StyleSource } from "./StyleSource.ts";
import { keyName } from "./keyName.ts";
import { objectStyleSource } from "./objectStyleSource.ts";
import { styleKeys } from "./styleKeys.ts";

/**
 * The E1809 style source of an element's attributes: `gap`, `direction`, `look` and the object literal entries of
 * `states`. A spread attribute may carry a `direction`; a valueless or empty attribute reads as not static.
 */
export function jsxStyleSource(attrs: readonly JSXAttributeItem[]): StyleSource {
  let gap: StyleProp | undefined;
  let direction: StyleProp | undefined;
  let look: string | null | undefined;
  let spread = false;
  const states = new Map<string, StyleSource>();
  for (const a of attrs) {
    if (a.type !== "JSXAttribute") {
      spread = true;
      continue;
    }
    if (a.name.type !== "JSXIdentifier") continue;
    const name = a.name.name;
    const v = a.value;
    const e = v?.type === "JSXExpressionContainer" && v.expression.type !== "JSXEmptyExpression" ? v.expression : null;
    const literal = v?.type === "Literal" && typeof v.value === "string" ? v.value : null;
    const prop: StyleProp =
      literal !== null
        ? { keys: ["base"], start: a.start }
        : e?.type === "ObjectExpression"
          ? { keys: styleKeys(e), start: a.start, open: e.start + 1 }
          : { keys: e === null ? null : styleKeys(e), start: a.start };
    if (name === "gap") gap = prop;
    if (name === "direction") direction = prop;
    if (name === "look") look = literal ?? (e?.type === "Literal" && typeof e.value === "string" ? e.value : null);
    if (name === "states" && e?.type === "ObjectExpression")
      for (const p of e.properties) {
        const state = p.type === "Property" ? keyName(p) : null;
        if (p.type === "Property" && state !== null && p.value.type === "ObjectExpression")
          states.set(state, objectStyleSource(p.value));
      }
  }
  return {
    jsx: true,
    spread,
    states,
    ...(gap === undefined ? {} : { gap }),
    ...(direction === undefined ? {} : { direction }),
    ...(look === undefined ? {} : { look }),
  };
}
