/** The closed set of events `fire` dispatches (k.testing). `input` sets the element's value first. */
export type TestEvent =
  | { readonly type: "click" }
  | { readonly type: "input"; readonly value: string }
  | { readonly type: "change" }
  | { readonly type: "keydown"; readonly key: string }
  | { readonly type: "submit" }
  | { readonly type: "focus" }
  | { readonly type: "blur" };
