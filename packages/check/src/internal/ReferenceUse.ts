/**
 * How a reference to a literal binding is used (k.privacy-reads Held): one the read takes (`taken`), any other
 * (`other`), the initializer of a top-level `const` (`alias`, held only while that binding is), an export under `name`
 * (`export`), or an argument of the call starting at `call` (`argument`, taken when its callee is `s.<name>` of
 * `@keel/schema`).
 */
export type ReferenceUse =
  | { readonly kind: "taken" }
  | { readonly kind: "other" }
  | { readonly kind: "alias"; readonly name: string; readonly exported: boolean }
  | { readonly kind: "export"; readonly name: string }
  | { readonly kind: "argument"; readonly call: number };
