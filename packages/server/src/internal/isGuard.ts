import type { Guard } from "@keel/router";

/** Whether `v` is a `Guard` from `guard()` (a route may hold the guard itself instead of its name). */
export function isGuard(v: unknown): v is Guard {
  return (
    typeof v === "object" &&
    v !== null &&
    "kind" in v &&
    v.kind === "keel.guard" &&
    "name" in v &&
    typeof v.name === "string" &&
    "redirect" in v &&
    typeof v.redirect === "string" &&
    "run" in v &&
    typeof v.run === "function"
  );
}
