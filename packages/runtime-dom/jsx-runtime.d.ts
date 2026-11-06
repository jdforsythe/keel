// JSX types for Keel app code (k.component, k.compiler). Types only: the compiler lowers JSX to runtime ops,
// so there is no jsx() runtime. Resolved by `jsxImportSource: "@keel/runtime-dom"`.

/** An event handler attribute (`onClick`, `onInput`, ...). */
type Handler = (event: Event) => unknown;
/** What an intrinsic element accepts as an attribute value or child (dynamic expressions are bindings). */
type Value = string | number | boolean | null | undefined | Node | Handler | readonly Value[];

export declare namespace JSX {
  /** Every element and component call evaluates to a DOM node. */
  type Element = Node;
  /** JSX children arrive as the `children` prop (RFC 0008). */
  interface ElementChildrenAttribute {
    children: {};
  }
  /** Intrinsic elements: a loose map of tag to attributes; `on*` attributes take handlers. */
  interface IntrinsicElements {
    [tag: string]: { readonly [attr: `on${string}`]: Handler | undefined; readonly [attr: string]: Value };
  }
}
