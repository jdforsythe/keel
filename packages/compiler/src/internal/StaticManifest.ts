import type { JsonValue } from "@keel/schema";

/** `deps` and `std` of a literal `module({...})` manifest (k.module), with offsets; `std` values `undefined` when not literal JSON. */
export type StaticManifest = {
  readonly deps: readonly { readonly value: string; readonly start: number }[];
  readonly std: readonly { readonly key: string; readonly start: number; readonly value: JsonValue | undefined }[];
};
