/** The groups that take no theme (k.themes Themes). */
const NO_THEME = ["breakpoint", "motion", "base", "look"];
/** `not a <group> value`, `an` before a vowel (`not an overlay value`). */
const notA = (g: string): string => `not ${/^[aeiou]/.test(g) ? "an" : "a"} ${g} value`;

/**
 * Why `TokenSchema`'s closed shape refuses the value at `path` with `rule` (k.themes Token errors): an unknown key,
 * `when`, `schemes`, or a value of the wrong type, `not a <group> value` with the group a theme's path names.
 */
export function shapeWhat(path: readonly (string | number)[], rule: string): string {
  const [top, theme, group] = path.map(String);
  if (top === "schemes") return 'is ["light"], ["dark"] or ["light", "dark"]';
  if (rule === "unknown-key") {
    if (path.length === 1) return "is no token group";
    if (top === "themes" && path.length === 3 && group !== undefined && NO_THEME.includes(group))
      return `${group} takes no theme`;
    return "is no key here";
  }
  if (top === "themes" && path.length === 3 && group === "when") return "when is choice, contrast or print";
  if (top === "themes" && group !== undefined) return notA(group);
  return notA(top ?? "token");
}
