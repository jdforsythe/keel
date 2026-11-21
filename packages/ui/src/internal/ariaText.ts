import type { Value } from "@keel/runtime-dom/ops";

/** An ARIA attribute value: a boolean as `"true"`/`"false"`, a string or number as itself, anything else absent. */
export function ariaText(v: unknown): Value {
  return typeof v === "boolean" ? String(v) : typeof v === "string" || typeof v === "number" ? v : null;
}
