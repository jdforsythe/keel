/**
 * One atomic style usage in `styles.json` (k.ui): a single style prop with a static token, under an optional
 * breakpoint and state. The one definition (RFC 0046): `@keel/ui/css` re-exports it for `compileStyles`, which turns
 * the list into CSS.
 */
export type StyleUsage = {
  readonly props: Readonly<Record<string, string>>;
  readonly breakpoint?: string;
  readonly state?: "hover" | "focusVisible" | "active" | "disabled";
};
