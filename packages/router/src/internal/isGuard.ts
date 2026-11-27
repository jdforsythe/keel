import type { ApiGuard } from "../types/ApiGuard.ts";
import { records } from "./records.ts";

/** Whether `v` is a value `guard(decl, fn)` made in this realm (k.identity), read from the router's record, never from a property. */
export function isGuard(v: unknown): v is ApiGuard {
  return typeof v === "object" && v !== null && records.guard.has(v);
}
