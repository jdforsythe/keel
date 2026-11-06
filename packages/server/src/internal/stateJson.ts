const UNSAFE: ReadonlyMap<string, string> = new Map([
  ["<", "\\u003c"],
  [">", "\\u003e"],
  ["&", "\\u0026"],
  [String.fromCharCode(0x2028), "\\u2028"],
  [String.fromCharCode(0x2029), "\\u2029"],
]);

/** JSON for an inline `<script type="application/json">`: `<`, `>`, `&`, U+2028/9 escaped so it cannot close the tag. */
export function stateJson(value: unknown): string {
  return [...(JSON.stringify(value) ?? "null")].map((c) => UNSAFE.get(c) ?? c).join("");
}
