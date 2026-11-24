import { createHash } from "node:crypto";

/** The SHA-256 of a listing's names, sorted: the answer a folder listing probe records. */
export function listHash(names: readonly string[]): string {
  return createHash("sha256")
    .update([...names].sort().join("\u0000"))
    .digest("hex");
}
