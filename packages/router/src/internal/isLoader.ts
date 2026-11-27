import type { Loader } from "../types/Loader.ts";
import { records } from "./records.ts";

/** Whether `v` is a value `loader(contract, id, decl, fn)` made in this realm (k.identity), read from the router's record, never from a property. */
export function isLoader(v: unknown): v is Loader {
  return typeof v === "object" && v !== null && records.loader.has(v);
}
