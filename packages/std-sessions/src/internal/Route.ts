import type { JsonObject } from "./JsonObject.ts";

/** A recorded route: its id and encoded params and search. */
export type Route = { readonly id: string; readonly params: JsonObject; readonly search: JsonObject };
