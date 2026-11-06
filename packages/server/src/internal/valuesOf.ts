/** Keys that could reach `Object.prototype` when the values are spread or merged (red team M2). */
const UNSAFE_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Submitted FormData as plain values (a repeated key gives an array; a file gives its name). Built with
 * `Object.fromEntries` (own data properties only); `__proto__`, `constructor`, and `prototype` are dropped.
 */
export function valuesOf(form: FormData): Readonly<Record<string, string | readonly string[]>> {
  return Object.fromEntries(
    [...new Set(form.keys())]
      .filter((key) => !UNSAFE_KEYS.has(key))
      .map((key) => {
        const all = form.getAll(key).map((v) => (typeof v === "string" ? v : v.name));
        return [key, all.length === 1 ? (all[0] ?? "") : all] as const;
      }),
  );
}
