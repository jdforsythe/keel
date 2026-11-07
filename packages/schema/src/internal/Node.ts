/** The descriptor tree: the single source walked by validation, codec, generator and doc. Plain JSON data. */
export type Node =
  | { readonly kind: "string"; readonly min: number; readonly max: number | undefined }
  | { readonly kind: "number"; readonly min?: number; readonly max?: number }
  | { readonly kind: "int"; readonly min?: number; readonly max?: number }
  | { readonly kind: "boolean" }
  | { readonly kind: "literal"; readonly value: string | number | boolean }
  | { readonly kind: "enum"; readonly values: readonly string[] }
  | { readonly kind: "id"; readonly brand: string }
  | { readonly kind: "json" }
  | { readonly kind: "object"; readonly fields: Readonly<Record<string, Node>>; readonly closed?: boolean }
  | { readonly kind: "array"; readonly item: Node }
  | { readonly kind: "record"; readonly value: Node }
  | { readonly kind: "union"; readonly key: string; readonly variants: readonly Node[] }
  | { readonly kind: "anyOf"; readonly members: readonly Node[] }
  | { readonly kind: "nullable"; readonly inner: Node }
  | { readonly kind: "optional"; readonly inner: Node }
  | { readonly kind: "secret"; readonly inner: Node };
