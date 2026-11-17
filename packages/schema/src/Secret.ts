import { listening } from "./internal/listening.ts";

const MARKER = "[secret]";
const INSPECT = Symbol.for("nodejs.util.inspect.custom");

/**
 * The parsed value of `s.secret(inner)` (k.schema Secrets). The value lives in a private field: JSON, `String()`,
 * templates and `inspect` print `[secret]`; keys, spread and `structuredClone` see nothing. Read it with `reveal`.
 * Only the type is public; the statics are for @keel/schema internals.
 */
export class Secret<T> {
  static readonly marker = MARKER;
  readonly #value: T;

  private constructor(value: T) {
    this.#value = value;
    Object.freeze(this);
  }

  static of<T>(value: T): Secret<T> {
    const made = new Secret(value);
    listening.current?.(made);
    return made;
  }

  static is(x: unknown): x is Secret<unknown> {
    return typeof x === "object" && x !== null && #value in x;
  }

  static open<T>(secret: Secret<T>): T {
    return secret.#value;
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
