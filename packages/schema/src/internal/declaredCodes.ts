/** Where the realm keeps the codes `s.error` declared, shared by every copy of `@keel/schema` loaded in it. */
const KEY = Symbol.for("keel.errorCodes");

/**
 * The error codes `s.error` declared in this realm (k.serverlog Thrown values): a log writes a thrown `KeelError`'s
 * code only when it is one of these or a kernel code, since any other code is text the thrown value chose.
 */
export function declaredCodes(): Set<string> {
  const held: unknown = Reflect.get(globalThis, KEY);
  if (held instanceof Set) return held;
  const made = new Set<string>();
  Object.defineProperty(globalThis, KEY, { value: made });
  return made;
}
