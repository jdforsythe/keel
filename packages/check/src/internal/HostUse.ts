import type { Expression } from "oxc-parser";

/**
 * One use of `@keel/ui`'s `Host` (k.host-element): a JSX `<Host>` or a `Host({...})` call. `props` holds each prop
 * written by name: its start and its value expression (`null` for a JSX string or a valueless attribute). `spread`
 * is true when a prop may come from somewhere the rule cannot read (a JSX spread, a spread or non-literal argument).
 */
export type HostUse = {
  readonly start: number;
  readonly spread: boolean;
  readonly props: ReadonlyMap<string, { readonly start: number; readonly value: Expression | null }>;
};
