import { kernelSet } from "@keel/schema/internal";
import type { Loader } from "../types/Loader.ts";

/** Whether `v` is a value `loader(contract, id, decl, fn)` made in this realm (k.identity), read from the kernel's record, never from a property. */
export function isLoader(v: unknown): v is Loader {
  return typeof v === "object" && v !== null && kernelSet("router.loader").has(v);
}
