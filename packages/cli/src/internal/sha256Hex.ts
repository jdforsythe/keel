import { createHash } from "node:crypto";

/** The SHA-256 of `bytes` as lower-case hex. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
