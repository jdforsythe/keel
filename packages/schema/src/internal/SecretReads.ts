import type { Secret } from "../Secret.ts";
import type { Node } from "./Node.ts";

/** The reads and the maker of `Secret`, private to `@keel/schema` (k.identity Secret): no static member holds them. */
export interface SecretReads {
  /** A new secret of `value`, sealed under `inner`; the listener hears of it. */
  of<T>(value: T, inner: Node): Secret<T>;
  /** Whether `x` is a secret made in this realm (the kernel's record). */
  is(x: unknown): x is Secret<unknown>;
  /** The value inside `secret`. */
  open<T>(secret: Secret<T>): T;
  /** The node `secret` was sealed under. */
  innerOf(secret: Secret<unknown>): Node;
}
