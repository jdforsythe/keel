import { records } from "./records.ts";

/** Whether `x` is a coded refusal a kernel package made in this realm (k.deploy Refusals at start, k.identity). */
export function isRefusal(x: unknown): x is Error & { readonly code: string } {
  return x instanceof Error && records.refusal.has(x);
}
