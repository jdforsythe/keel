/** A style rule of a stylesheet (`cssRules`): its selector, the at-rules around it, and its declarations in order. */
export type CssRule = {
  readonly selector: string;
  /** `@layer` names, outermost first. */
  readonly layers: readonly string[];
  /** `@media` preludes, outermost first. */
  readonly media: readonly string[];
  /** `@supports` preludes, outermost first. */
  readonly supports: readonly string[];
  readonly decls: readonly { readonly prop: string; readonly value: string }[];
};
