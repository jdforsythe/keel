import { placeholders } from "./placeholders.ts";

/** A template of 1 to 2,000 characters whose braces are all `{name}` placeholders naming one of `names`. */
export function templateOk(t: unknown, names: readonly string[]): boolean {
  if (typeof t !== "string" || t.length < 1 || t.length > 2000) return false;
  return placeholders(t)?.every((p) => names.includes(p.name)) === true;
}
