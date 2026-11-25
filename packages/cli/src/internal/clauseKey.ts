import { createHash } from "node:crypto";
import { normClause } from "./normClause.ts";

/** A clause's key (k.ledger-items Clause key): the first 8 lowercase hex digits of the SHA-256 of its normal form. */
export function clauseKey(text: string): string {
  return createHash("sha256").update(normClause(text), "utf8").digest("hex").slice(0, 8);
}
