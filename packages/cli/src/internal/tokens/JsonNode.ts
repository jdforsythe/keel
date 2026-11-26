import type { JsonMember } from "./JsonMember.ts";

/** A JSON value with the offset in the text where it begins (`jsonTree`). */
export type JsonNode =
  | { readonly kind: "object"; readonly at: number; readonly members: readonly JsonMember[] }
  | { readonly kind: "array"; readonly at: number; readonly items: readonly JsonNode[] }
  | { readonly kind: "string"; readonly at: number; readonly value: string }
  | { readonly kind: "number"; readonly at: number; readonly value: number }
  | { readonly kind: "literal"; readonly at: number; readonly value: boolean | null };
