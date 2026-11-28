import type { Schema } from "@keel/schema";
import { secretKey } from "./secretKey.ts";

/** Keys that could reach `Object.prototype` when the values are spread or merged (red team M2). */
const UNSAFE_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Submitted FormData as plain values (a repeated key gives an array; a file gives its name). Built with
 * `Object.fromEntries` (own data properties only); `__proto__`, `constructor`, `prototype`, and every key that
 * reaches an `s.secret` node of `root` (`secretKey`) are dropped, so a secret is never echoed.
 */
export function valuesOf(
  form: FormData,
  root: Schema<unknown>["node"],
): Readonly<Record<string, string | readonly string[]>> {
  return Object.fromEntries(
    [...new Set(form.keys())]
      .filter((key) => !UNSAFE_KEYS.has(key) && !secretKey(root, key))
      .map((key) => {
        const all = form.getAll(key).map((v) => (typeof v === "string" ? v : v.name));
        return [key, all.length === 1 ? (all[0] ?? "") : all] as const;
      }),
  );
}
