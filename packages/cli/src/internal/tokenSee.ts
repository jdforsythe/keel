/** The `<what>` texts of E1807 and the section each rule is in (k.themes Token errors); the rest are k.values. */
const SECTIONS: readonly (readonly [RegExp, string])[] = [
  [
    /^(default, system, light and dark are reserved|a theme name is |when is |\S+ takes no theme$|not a top-level |a print theme takes |a second (contrast|print) theme$|a ninth choice theme)/,
    "k.themes",
  ],
  [/^is \["light"\]/, "k.schemes"],
  [/^(is no token group|is no key here|under 3:1 on base\.page's bg in )/, "k.ui"],
];

/** The spec section E1807's `see` names for a message's `<what>` (k.themes Token errors). */
export function tokenSee(what: string): string {
  return SECTIONS.find(([re]) => re.test(what))?.[1] ?? "k.values";
}
