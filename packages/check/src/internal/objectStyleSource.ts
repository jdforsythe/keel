import type { Expression, ObjectExpression } from "oxc-parser";
import type { StyleProp } from "./StyleProp.ts";
import type { StyleSource } from "./StyleSource.ts";
import { keyName } from "./keyName.ts";
import { styleKeys } from "./styleKeys.ts";

const propOf = (e: Expression, start: number): StyleProp =>
  e.type === "ObjectExpression" ? { keys: styleKeys(e), start, open: e.start + 1 } : { keys: styleKeys(e), start };

/** The `states` entries of an object literal that are object literals themselves, by state name. */
function statesOf(e: Expression): ReadonlyMap<string, StyleSource> {
  const out = new Map<string, StyleSource>();
  if (e.type !== "ObjectExpression") return out;
  for (const p of e.properties) {
    const name = p.type === "Property" ? keyName(p) : null;
    if (p.type === "Property" && name !== null && p.value.type === "ObjectExpression")
      out.set(name, objectStyleSource(p.value));
  }
  return out;
}

/** The E1809 style source of a style object literal: a part style or a `states` entry. */
export function objectStyleSource(obj: ObjectExpression): StyleSource {
  let gap: StyleProp | undefined;
  let direction: StyleProp | undefined;
  let look: string | null | undefined;
  let spread = false;
  let states: ReadonlyMap<string, StyleSource> = new Map();
  for (const p of obj.properties) {
    if (p.type !== "Property") {
      spread = true;
      continue;
    }
    const name = keyName(p);
    if (name === "gap") gap = propOf(p.value, p.start);
    if (name === "direction") direction = propOf(p.value, p.start);
    if (name === "look") look = p.value.type === "Literal" && typeof p.value.value === "string" ? p.value.value : null;
    if (name === "states") states = statesOf(p.value);
  }
  return {
    jsx: false,
    spread,
    states,
    ...(gap === undefined ? {} : { gap }),
    ...(direction === undefined ? {} : { direction }),
    ...(look === undefined ? {} : { look }),
  };
}
