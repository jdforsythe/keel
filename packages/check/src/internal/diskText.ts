import { createHash } from "node:crypto";
import fs from "node:fs";

/**
 * A file's text as TypeScript's `sys.readFile` decodes it (a UTF-16 or UTF-8 byte order mark read and dropped), with
 * the SHA-256 of its bytes; `undefined` when it cannot be read (absent, a folder, no permission).
 */
export function diskText(fileName: string): { readonly text: string; readonly hash: string } | undefined {
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(fileName);
  } catch {
    return undefined;
  }
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = Buffer.from(bytes.subarray(0, bytes.length & ~1));
    swapped.swap16();
    return { text: swapped.toString("utf16le", 2), hash };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return { text: bytes.toString("utf16le", 2), hash };
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return { text: bytes.toString("utf8", 3), hash };
  return { text: bytes.toString("utf8"), hash };
}
