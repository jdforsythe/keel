/** A P3 block as `compileStyles` writes it: `@media <conditions> and (color-gamut: p3){`, one rule, `}`. */
const P3_BLOCK = /^@media ([^\n{]*\(color-gamut: p3\))\{\n([^\n]*)\n\}$/gm;

/** The query a browser that reads `color()` matches. */
const P3_SUPPORTS = "(color: color(display-p3 0 0 0))";

/**
 * `css` (`compileStyles`'s) with each P3 block under `@supports (color: color(display-p3 0 0 0))`, for a build whose
 * target names a browser older than `color()` (`lacksColorFunction`, k.gamut CSS): such a browser keeps the sRGB
 * forms on a P3 screen instead of an unusable value.
 */
export function guardP3(css: string): string {
  return css.replace(
    P3_BLOCK,
    (_m, conds: string, rule: string) => `@supports ${P3_SUPPORTS}{\n@media ${conds}{\n${rule}\n}\n}`,
  );
}
