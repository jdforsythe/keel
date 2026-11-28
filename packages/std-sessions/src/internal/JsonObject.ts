import type { JsonValue } from "@keel/schema";

/** A JSON object (route params, search, store states by id). */
export type JsonObject = { readonly [k: string]: JsonValue };
