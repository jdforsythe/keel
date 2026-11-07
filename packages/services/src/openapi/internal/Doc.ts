/**
 * Generated source before layout: flat text, an object literal (always printed one key per line, which biome
 * keeps), an array, or a call with arguments and a trailing member chain (`.nullable()`, `.optional()`).
 */
export type Doc =
  | string
  | { readonly t: "obj"; readonly entries: readonly (readonly [string, Doc])[] }
  | { readonly t: "arr"; readonly items: readonly Doc[] }
  | { readonly t: "call"; readonly callee: string; readonly args: readonly Doc[]; readonly suffix: string };
