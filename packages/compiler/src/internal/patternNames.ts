import type { BindingPattern, BindingRestElement, ParamPattern } from "oxc-parser";
import { patternIdents } from "./patternIdents.ts";

/** Every name a binding pattern declares (`{ a, b: [c], ...d }` -> a, c, d). */
export function patternNames(p: BindingPattern | BindingRestElement | ParamPattern): string[] {
  return patternIdents(p).map((x) => x.name);
}
