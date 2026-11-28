import { createHash } from "node:crypto";

/** A key's id (k.evidence Signing): the first 16 hex characters of the SHA-256 of its raw public key bytes. */
export function keyIdOf(raw: Uint8Array): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}
