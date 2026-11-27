/**
 * A browser problem (k.e2e-page Problems): `pageerror` an error the page did not catch, `console` a console error, `warning` a console warning,
 * `csp` a content security policy violation (`script-src blocked inline`), `offsite` a request the run refused
 * (`GET https://example.org/x`, k.e2e-run Reach), `dialog` a dialog the page opened.
 */
export type Problem = {
  readonly kind: "pageerror" | "console" | "warning" | "csp" | "offsite" | "dialog";
  readonly text: string;
};
