import type { JsonValue } from "@keel/schema";

/**
 * `id`, `deps` and `std` of a literal `module({...})` manifest (k.module), with offsets; `id` `undefined` when not a
 * string literal, `std` values `undefined` when not literal JSON.
 */
export type StaticManifest = {
  readonly id: string | undefined;
  readonly deps: readonly { readonly value: string; readonly start: number }[];
  readonly std: readonly { readonly key: string; readonly start: number; readonly value: JsonValue | undefined }[];
};
