import type { BindingPattern, BindingRestElement, ParamPattern } from "oxc-parser";

/**
 * The names and spans of the names a binding pattern declares (`{ a = b, c: [d], ...e }` -> a, d, e). Defaults and computed
 * keys are reads, not declarations, so they are not covered.
 */
export function patternIdents(
  p: BindingPattern | BindingRestElement | ParamPattern,
): { name: string; start: number; end: number }[] {
  switch (p.type) {
    case "Identifier":
      return [{ name: p.name, start: p.start, end: p.end }];
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
