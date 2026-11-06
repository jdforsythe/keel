import type { JSXAttribute, JSXElement } from "oxc-parser";
import { attrNameOf } from "./attrNameOf.ts";

/** The attribute `name` on a JSX element, if present (last one wins, as in JSX). */
export function attrOf(el: JSXElement, name: string): JSXAttribute | undefined {
  let found: JSXAttribute | undefined;
  for (const at of el.openingElement.attributes) {
    if (at.type === "JSXAttribute" && attrNameOf(at.name) === name) found = at;
  }
  return found;
}
