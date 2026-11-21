/** A JSON Schema node of `surface.json`, read as the k.schema kind it encodes (k.compat Accepts). */
export type Shape =
  | { readonly kind: "any" }
  | { readonly kind: "union"; readonly members: readonly unknown[] }
  | { readonly kind: "const"; readonly value: unknown }
  | { readonly kind: "enum"; readonly values: readonly unknown[] }
  | { readonly kind: "string"; readonly min: number; readonly max: number | undefined; readonly format: unknown }
  | {
      readonly kind: "number";
      readonly int: boolean;
      readonly min: number | undefined;
      readonly max: number | undefined;
    }
  | { readonly kind: "boolean" | "null" }
  | { readonly kind: "array"; readonly items: unknown }
  | {
      readonly kind: "object";
      readonly props: Readonly<Record<string, unknown>>;
      readonly required: ReadonlySet<string>;
      readonly closed: boolean;
    }
  | { readonly kind: "record"; readonly value: unknown }
  | { readonly kind: "unknown" };
