import type { Node } from "./internal/Node.ts";
import { listening } from "./internal/listening.ts";

const MARKER = "[secret]";
const INSPECT = Symbol.for("nodejs.util.inspect.custom");

/**
 * The parsed value of `s.secret(inner)` (k.schema Secrets). The value lives in a private field: JSON, `String()`,
 * templates and `inspect` print `[secret]`; keys, spread and `structuredClone` see nothing. Read it with `reveal`.
 * The instance also holds the node it was sealed under, so the internal read of its values can tell a data key from a
 * declared field name. Only the type is public; the statics are for @keel/schema internals.
 */
export class Secret<T> {
  static readonly marker = MARKER;
  readonly #value: T;
  readonly #inner: Node;

  private constructor(value: T, inner: Node) {
    this.#value = value;
    this.#inner = inner;
    Object.freeze(this);
  }

  /**
   * A new secret of `value`, sealed under `inner` (the `secret` node's inner node); the listener hears of it. Its
   * maker freezes `value` deep (`freeze`) once it is known good, so what `reveal` returns cannot change.
   */
  static of<T>(value: T, inner: Node): Secret<T> {
    const made = new Secret(value, inner);
    listening.current?.(made);
    return made;
  }

  static is(x: unknown): x is Secret<unknown> {
    return typeof x === "object" && x !== null && #value in x;
  }

  static open<T>(secret: Secret<T>): T {
    return secret.#value;
  }

  /** The node `secret` was sealed under. For `secretValues` only. */
  static innerOf(secret: Secret<unknown>): Node {
    return secret.#inner;
  }

  toJSON(): string {
    return MARKER;
  }

  toString(): string {
    return MARKER;
  }

  [Symbol.toPrimitive](): string {
    return MARKER;
  }

  [INSPECT](): string {
    return MARKER;
  }
}
