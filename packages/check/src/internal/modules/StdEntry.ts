import type { JsonValue } from "@keel/schema";

/** One `std` entry of a manifest (k.module, RFC 0047): package key, its offset, and its literal JSON (`undefined`: not literal). */
export type StdEntry = { readonly key: string; readonly start: number; readonly value: JsonValue | undefined };
