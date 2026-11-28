import { defect } from "./defect.ts";
import type { Node } from "./internal/Node.ts";
import { SECRET_MARKER } from "./internal/SECRET_MARKER.ts";
import { listening } from "./internal/listening.ts";
import { records } from "./internal/records.ts";
import { secretSlot } from "./internal/secretSlot.ts";

const INSPECT = Symbol.for("nodejs.util.inspect.custom");
/** Only this module holds it, so only `@keel/schema` makes a secret; any other `new` is the defect E1764. */
const TOKEN: object = Object.freeze({});

/**
 * The parsed value of `s.secret(inner)` (k.privacy Secrets). The value lives in a private field: JSON, `String()`,
 * templates and `inspect` print `[secret]`; keys, spread and `structuredClone` see nothing. Read it with `reveal`.
 * The class has no static member (k.identity Secret): its maker and reads are the package's own.
 */
export class Secret<T> {
  readonly #value: T;
  readonly #inner: Node;

  private constructor(value: T, inner: Node, token: unknown) {
    if (token !== TOKEN) defect("Secret made outside @keel/schema", { code: "E1764" });
    this.#value = value;
    this.#inner = inner;
    records.secret.add(this);
    Object.freeze(this);
  }

  static {
    secretSlot.set({
      of<V>(value: V, inner: Node): Secret<V> {
        const secret = new Secret(value, inner, TOKEN);
        listening.current?.(secret);
        return secret;
      },
      is: (x: unknown): x is Secret<unknown> => typeof x === "object" && x !== null && records.secret.has(x),
      open: <V>(secret: Secret<V>): V => secret.#value,
      innerOf: (secret: Secret<unknown>): Node => secret.#inner,
    });
  }

  toJSON(): string {
    return SECRET_MARKER;
  }

  toString(): string {
    return SECRET_MARKER;
  }

  [Symbol.toPrimitive](): string {
    return SECRET_MARKER;
  }

  [INSPECT](): string {
    return SECRET_MARKER;
  }
}
