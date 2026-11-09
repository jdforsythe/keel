/** A statically read schema shape. `any` = unresolved or `s.json()`: every deeper path is accepted. */
export type ShapeNode =
  | { readonly kind: "any" }
  | { readonly kind: "leaf" }
  | { readonly kind: "array"; readonly item: ShapeNode }
  | { readonly kind: "record"; readonly value: ShapeNode }
  | { readonly kind: "object"; readonly fields: ReadonlyMap<string, ShapeNode>; readonly open: boolean };
