import type { JsonValue } from "@keel/schema";

/** The data of `.keel/std.json` (k.module, rfc:0066): each stdlib package's config by app module id. */
export type StdData = { readonly [pkg: string]: { readonly [moduleId: string]: JsonValue } };
