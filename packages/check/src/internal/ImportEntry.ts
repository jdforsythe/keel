import type { SourceFile } from "../types/SourceFile.ts";

/**
 * One way the file `from` takes a project file's exports: a named or default import (`import`, `imported` bound to
 * `local`), a namespace import (`namespace`, bound to `local`), a re-export (`reexport`, `imported` as `exported`),
 * `export *` (`star`), `export * as` (`starAs`) or an `import()` (`dynamic`). Type-only forms are not listed.
 */
export type ImportEntry =
  | { readonly kind: "import"; readonly from: SourceFile; readonly imported: string; readonly local: string }
  | { readonly kind: "namespace"; readonly from: SourceFile; readonly local: string }
  | { readonly kind: "reexport"; readonly from: SourceFile; readonly imported: string; readonly exported: string }
  | { readonly kind: "star" | "starAs" | "dynamic"; readonly from: SourceFile };
