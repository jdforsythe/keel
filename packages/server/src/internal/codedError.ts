import { enrol, refusal } from "@keel/schema/internal";

// The server enters the realm's census as its module graph is evaluated (k.realm One copy): every entry reaches
// this module.
enrol("@keel/server", import.meta.url);

/**
 * A coded refusal (k.deploy Refusals at start): an Error carrying a stable diagnostic code (`E15xx`), its message
 * starting with the code, kernel-held (`isRefusal` of `@keel/schema/internal`).
 */
export function codedError(code: `E${number}`, message: string): Error & { readonly code: string } {
  return refusal(code, message);
}
