/**
 * A browser problem (k.e2e-page Problems): `pageerror` an error the page did not catch, `console` a console error, `warning` a console warning,
 * `csp` a content security policy violation (`script-src blocked inline`).
 */
export type Problem = { readonly kind: "pageerror" | "console" | "warning" | "csp"; readonly text: string };
