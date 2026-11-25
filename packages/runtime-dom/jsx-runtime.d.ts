// JSX types for Keel app code (k.component, k.compiler). The compiler lowers JSX to runtime ops, so the runtime
// `jsx`, `jsxs` and `Fragment` (src/jsx-runtime/) only throw: a `tsc` build of JSX imports and never renders.
// Resolved by `jsxImportSource: "@keel/runtime-dom"`.

/** An event handler attribute (`onClick`, `onInput`, ...). */
type Handler = (event: Event) => unknown;
/** What an intrinsic element accepts as an attribute value or child (dynamic expressions are bindings). */
type Value = string | number | boolean | null | undefined | Node | Handler | readonly Value[];

/** A thunk, as compiled JSX children are. */
type Thunk = () => unknown;
/** Whether a component's first parameter takes `children` only as a thunk. */
type ThunkOnly<C> = C extends (props: infer Q, ...rest: never[]) => unknown
  ? Q extends { readonly children?: infer K }
    ? [NonNullable<K>] extends [never]
      ? false
      : [Exclude<NonNullable<K>, Thunk>] extends [never]
        ? true
        : false
    : false
  : false;

export declare namespace JSX {
  /** Every element and component call evaluates to a DOM node. */
  type Element = Node;
  /** JSX children arrive as the `children` prop (RFC 0008). */
  interface ElementChildrenAttribute {
    children: {};
  }
  /**
   * A component's props as JSX checks them: a `children` that takes only a thunk also takes the children written
   * between its tags, which compile to that thunk; a call without JSX still needs the thunk.
   */
  type LibraryManagedAttributes<C, P> = ThunkOnly<C> extends true
    ? { [K in keyof P]: K extends "children" ? P[K] | Value : P[K] }
    : P;
  /** Intrinsic elements: a loose map of tag to attributes; `on*` attributes take handlers. */
  interface IntrinsicElements {
    [tag: string]: { readonly [attr: `on${string}`]: Handler | undefined; readonly [attr: string]: Value };
  }
}
