import type { ToolKind } from "./ToolKind.ts";

type Span = { readonly start: number; readonly end: number };

/** A `messages(locales, keys, load)` declaration read from a `*.schema.ts` file. */
export type SetDecl = {
  readonly name: string;
  /** Offset of the `messages` call. */
  readonly at: number;
  /** The locales argument's identifier. */
  readonly locales: string | undefined;
  /** Every property of the keys object, in order (removal spans). */
  readonly items: readonly Span[];
  /** The declared keys; `index` points into `items`. */
  readonly keys: readonly (Span & {
    readonly name: string;
    readonly index: number;
    readonly params: ReadonlyMap<string, ToolKind>;
  })[];
  /** The `load` argument, and whether it is ``(locale) => import(`./<Set>/${locale}.ts`)``. */
  readonly load: (Span & { readonly exact: boolean }) | undefined;
  /** End of the keys argument: where a missing `load` goes. */
  readonly after: number;
};
