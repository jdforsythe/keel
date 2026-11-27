/**
 * One atomic style usage in `styles.json` (k.ui): a single style prop with a static token, under an optional
 * breakpoint and state (an interaction state, or a widget state of a part, k.aria), or a `look` an element names, whose
 * set the usage's own props replace per prop in its state. The one definition (RFC 0046): `@keel/ui/css` re-exports it for `compileStyles`, which turns
 * the list into CSS.
 */
export type StyleUsage = {
  readonly props: Readonly<Record<string, string>>;
  readonly look?: string;
  readonly breakpoint?: string;
  readonly state?:
    | "selected"
    | "checked"
    | "pressed"
    | "expanded"
    | "current"
    | "highlighted"
    | "hover"
    | "focusVisible"
    | "active"
    | "disabled";
};
