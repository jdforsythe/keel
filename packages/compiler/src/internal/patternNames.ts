import type { BindingPattern, BindingRestElement, ParamPattern } from "oxc-parser";

/** Every name a binding pattern declares (`{ a, b: [c], ...d }` -> a, c, d). */
export function patternNames(p: BindingPattern | BindingRestElement | ParamPattern): string[] {
  switch (p.type) {
    case "Identifier":
      return [p.name];
    case "ObjectPattern":
      return p.properties.flatMap((x) => patternNames(x.type === "RestElement" ? x.argument : x.value));
    case "ArrayPattern":
      return p.elements.flatMap((x) => (x === null ? [] : patternNames(x)));
    case "AssignmentPattern":
      return patternNames(p.left);
    case "RestElement":
      return patternNames(p.argument);
    case "TSParameterProperty":
      return patternNames(p.parameter);
    default:
      return [];
  }
}
