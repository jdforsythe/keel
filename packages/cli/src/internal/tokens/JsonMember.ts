import type { JsonNode } from "./JsonNode.ts";

/** One `"key": value` pair of a JSON object, with the offset of the key's opening quote. */
export type JsonMember = { readonly key: string; readonly keyAt: number; readonly value: JsonNode };
