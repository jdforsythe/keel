import type { PostedForm } from "./PostedForm.ts";
import { isRecord } from "./isRecord.ts";

const texts = (x: unknown): x is string | readonly string[] =>
  typeof x === "string" || (Array.isArray(x) && x.every((v) => typeof v === "string"));

/** `#k-state`'s `form` posted to `href`, when it has the shape the server writes (`values` text, `errors` messages), else `null`. */
export function readForm(x: unknown, href: string): PostedForm | null {
  if (!isRecord(x) || typeof x.method !== "string" || !isRecord(x.values) || !isRecord(x.errors)) return null;
  const values: Record<string, string | readonly string[]> = {};
  for (const [k, v] of Object.entries(x.values)) if (texts(v)) values[k] = v;
  const errors: Record<string, string> = {};
  for (const [k, v] of Object.entries(x.errors)) if (typeof v === "string") errors[k] = v;
  return { href, method: x.method, values, errors };
}
