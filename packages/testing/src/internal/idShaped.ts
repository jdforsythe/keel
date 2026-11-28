import type { Schema } from "@keel/schema";

const VALID = /^[A-Za-z][A-Za-z0-9_-]*$/;

/**
 * `props` with its `id` made id-shaped: a plain-string `id` prop is an element's id (k.component), so a generated
 * value no element can carry (`"`, a space, a leading digit) is rewritten character by character to `a` where it
 * is not a letter, digit, `_` or `-` (a letter first). Its length stays, so the schema's bounds hold; when the schema
 * still refuses the result (a pattern), `props` is returned as generated.
 */
export function idShaped<P>(schema: Schema<P>, props: P): P {
  if (typeof props !== "object" || props === null) return props;
  const id: unknown = Reflect.get(props, "id");
  if (typeof id !== "string" || VALID.test(id)) return props;
  const shaped = Array.from(id, (c, i) => (/[A-Za-z]/.test(c) || (i > 0 && /[0-9_-]/.test(c)) ? c : "a")).join("");
  const next = { ...props, id: shaped };
  return schema.parse(next).ok ? next : props;
}
