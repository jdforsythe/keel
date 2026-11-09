/** An input event dispatched to an element (k.ctx Observers): the closed set k.testing `fire` sends (`TestEvent`). */
export type FireEvent =
  | { readonly type: "click" }
  | { readonly type: "input"; readonly value: string }
  | { readonly type: "change" }
  | { readonly type: "keydown"; readonly key: string }
  | { readonly type: "submit" }
  | { readonly type: "focus" }
  | { readonly type: "blur" };
