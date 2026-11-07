import type { JSXElement } from "oxc-parser";
import { roleFor } from "../a11y/roleFor.ts";
import { jsxAttrs } from "./jsxAttrs.ts";

/** Expected ARIA role of an element (the shared `roleFor` table); `null` when not known statically. */
export function roleOf(el: JSXElement, tag: string): string | null {
  return roleFor(tag, jsxAttrs(el)) ?? null;
}
