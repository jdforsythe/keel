import type { Mode } from "./Mode.ts";

/** The policy header's name (k.security Policy): report-only in dev, enforcing in production. */
export function policyHeader(mode: Mode): string {
  return mode === "dev" ? "content-security-policy-report-only" : "content-security-policy";
}
