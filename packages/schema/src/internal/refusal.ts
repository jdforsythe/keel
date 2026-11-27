import { codedRefusal } from "./codedRefusal.ts";
import { records } from "./records.ts";

/**
 * A coded refusal a kernel package raises with one of its own codes (k.deploy Refusals at start): kernel-held, so
 * the production entry prints its code, message and `see` and exits 1 (`isRefusal`).
 */
export function refusal(code: `E${number}`, message: string, see?: string): Error & { readonly code: string } {
  return codedRefusal(records.refusal, code, message, see);
}
