/**
 * Each WCAG criterion a rule maps to (k.a11y Claims) with the rules mapped to it: `render` the axe-core rules and
 * Keel codes the harness runs, `static` the Keel codes only `keel check` reports.
 */
export type A11yCriteriaMap = ReadonlyMap<
  string,
  { readonly render: readonly string[]; readonly static: readonly string[] }
>;
