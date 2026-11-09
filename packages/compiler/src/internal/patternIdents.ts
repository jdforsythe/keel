import type { BindingPattern, BindingRestElement, ParamPattern } from "oxc-parser";
import type { Span } from "./Span.ts";

/**
 * The spans of the names a binding pattern declares (`{ a = b, c: [d], ...e }` -> a, d, e). Defaults and computed
 * keys are reads, not declarations, so they are not covered.
 */
export function patternIdents(p: BindingPattern | BindingRestElement | ParamPattern): Span[] {
  switch (p.type) {
    case "Identifier":
      return [{ start: p.start, end: p.end }];
    case "ObjectPattern":
      return p.properties.flatMap((x) => patternIdents(x.type === "RestElement" ? x.argument : x.value));
    case "ArrayPattern":
      return p.elements.flatMap((x) => (x === null ? [] : patternIdents(x)));
    case "AssignmentPattern":
      return patternIdents(p.left);
    case "RestElement":
      return patternIdents(p.argument);
    case "TSParameterProperty":
      return patternIdents(p.parameter);
    default:
      return [];
  }
}
