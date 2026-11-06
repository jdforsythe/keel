/**
 * One atomic style usage in `styles.json` (k.ui): a single style prop with a static token, under an optional
 * breakpoint and state. Assignable to `StyleUsage` of `@keel/ui/css`, whose `compileStyles` turns the list into CSS.
 */
export type StyleUsage = {
  readonly props: Readonly<Record<string, string>>;
  readonly breakpoint?: string;
  readonly state?: "hover" | "focusVisible" | "active" | "disabled";
};
