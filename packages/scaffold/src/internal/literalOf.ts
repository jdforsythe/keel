import { quote } from "./quote.ts";

/** A JS literal for a JSON default value, or null when the value is not JSON. */
export function literalOf(v: unknown): string | null {
  if (typeof v === "string") return quote(v);
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : null;
  if (typeof v === "boolean" || v === null) return String(v);
  if (typeof v === "object") {
    const json = JSON.stringify(v);
    return typeof json === "string" ? json : null;
  }
  return null;
}
