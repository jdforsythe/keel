/**
 * The PascalCase form of a brand (std.brands): split at every character outside `[A-Za-z0-9]` and before an
 * uppercase letter that follows a lowercase letter or digit, drop empty parts, uppercase each part's first letter.
 */
export function pascalCase(brand: string): string {
  return brand
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter((p) => p !== "")
    .map((p) => `${p.charAt(0).toUpperCase()}${p.slice(1)}`)
    .join("");
}
