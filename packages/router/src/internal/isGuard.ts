import { kernelSet } from "@keel/schema/internal";
import type { ApiGuard } from "../types/ApiGuard.ts";

/** Whether `v` is a value `guard(decl, fn)` made in this realm (k.identity), read from the kernel's record, never from a property. */
export function isGuard(v: unknown): v is ApiGuard {
  return typeof v === "object" && v !== null && kernelSet("router.guard").has(v);
}
