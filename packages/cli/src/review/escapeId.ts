import { createHash } from "node:crypto";

/**
 * A finding's `id` (k.review Findings): the first 12 hex characters of the SHA-256 of `<code>\n<path>\n<text>`, the
 * text's whitespace runs one space and its ends trimmed, `#<n>` added for the n-th repeat of that code and text in
 * the file (the first is 0 and adds nothing).
 */
export function escapeId(code: string, path: string, text: string, ordinal: number): string {
  const norm = `${text.replace(/\s+/g, " ").trim()}${ordinal > 0 ? `#${ordinal}` : ""}`;
  return createHash("sha256").update(`${code}\n${path}\n${norm}`, "utf8").digest("hex").slice(0, 12);
}
