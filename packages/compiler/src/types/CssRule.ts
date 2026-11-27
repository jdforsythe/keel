/** A style rule of a stylesheet (`cssRules`): its selector, the at-rules around it, and its declarations in order. */
export type CssRule = {
  /** The selector, a nested rule's after its parent's and a space; empty for declarations an at-rule holds itself. */
  readonly selector: string;
  /** `@layer` names, outermost first. */
  readonly layers: readonly string[];
  /** `@media` preludes, outermost first. */
  readonly media: readonly string[];
  /** Every other at-rule around it as `@<name> <prelude>` (`@supports`, `@container`, `@scope`, any), outermost first. */
  readonly wrappers: readonly string[];
  readonly decls: readonly { readonly prop: string; readonly value: string }[];
};
