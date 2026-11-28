import { refusal } from "@keel/schema/internal";

/**
 * A coded refusal (k.deploy Refusals at start): an Error carrying a stable diagnostic code (`E15xx`), its message
 * starting with the code, kernel-held (`isRefusal` of `@keel/schema/internal`).
 */
export function codedError(code: `E${number}`, message: string): Error & { readonly code: string } {
  return refusal(code, message);
}
