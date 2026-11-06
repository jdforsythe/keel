/** A delegation root: one listener per bubbling event type on the mount or island element. */
export interface Root {
  listen(type: string): void;
  /** Move (or first attach) every listener to `el`. */
  attach(el: Element): void;
  dispose(): void;
}
