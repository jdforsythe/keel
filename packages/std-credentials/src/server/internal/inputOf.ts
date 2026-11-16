import type { Secret } from "@keel/schema";
import { textOf } from "./textOf.ts";

/** An unpaired UTF-16 surrogate: text with one has no UTF-8 form. */
const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/**
 * A password's text, NFKC-normalized, as UTF-8 bytes; `null` when the text is not well-formed Unicode (a lone
 * surrogate) or its bytes are empty or over 1,024.
 */
export function inputOf(secret: Secret<string>): Buffer | null {
  const text = textOf(secret);
  if (LONE.test(text)) return null;
  const bytes = Buffer.from(text.normalize("NFKC"), "utf8");
  if (bytes.length >= 1 && bytes.length <= 1024) return bytes;
  bytes.fill(0);
  return null;
}
