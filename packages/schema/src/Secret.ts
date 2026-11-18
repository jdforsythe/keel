import type { Node } from "./internal/Node.ts";
import { listening } from "./internal/listening.ts";

const MARKER = "[secret]";
const INSPECT = Symbol.for("nodejs.util.inspect.custom");

/** Freeze `v` and every object and array reachable from it by own keys, each once, at any depth without recursion. */
const freeze = (v: unknown): void => {
  const seen = new Set<unknown>();
  for (const todo = [v]; todo.length > 0; ) {
    const o = todo.pop();
    if (typeof o === "object" && o !== null && !seen.has(o)) {
      seen.add(o);
      Object.freeze(o);
      for (const k of Reflect.ownKeys(o)) todo.push(Reflect.get(o, k));
    }
  }
};

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
   * A new secret of `value`, sealed under `inner` (the `secret` node's inner node); the listener hears of it. `value`
   * and each object and array under it are frozen in place, so what `reveal` returns cannot change.
   */
  static of<T>(value: T, inner: Node): Secret<T> {
    freeze(value);
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
