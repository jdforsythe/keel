/**
 * A browser problem (k.e2e-page Problems): `pageerror` an error the page did not catch, `console` a console error,
 * `csp` a content security policy violation (`script-src blocked inline`).
 */
export type Problem = { readonly kind: "pageerror" | "console" | "csp"; readonly text: string };
