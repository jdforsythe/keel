import type { Secret } from "@keel/schema";
import { textOf } from "./textOf.ts";

/** A password's text, NFKC-normalized, as UTF-8 bytes; `null` when that is empty or over 1,024 bytes. */
export function inputOf(secret: Secret<string>): Buffer | null {
  const bytes = Buffer.from(textOf(secret).normalize("NFKC"), "utf8");
  if (bytes.length >= 1 && bytes.length <= 1024) return bytes;
  bytes.fill(0);
  return null;
}
