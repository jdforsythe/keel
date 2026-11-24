/**
 * The default title of a native shell (k.scaffold-shell Input): the `package.json` `name` with any `@scope/` dropped,
 * split at `-`, `_` and `.`, each word's first letter upper-cased, joined by spaces (`native-tauri` gives
 * `Native Tauri`). `""` when no word is left.
 */
export function shellName(pkgName: string): string {
  return pkgName
    .replace(/^@[^/]*\//, "")
    .split(/[-_.]/)
    .filter((w) => w !== "")
    .map((w) => `${w.charAt(0).toUpperCase()}${w.slice(1)}`)
    .join(" ");
}
