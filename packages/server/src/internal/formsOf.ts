const UTF8 = new TextEncoder();
const LONE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
const HEX = "0123456789abcdef";

const base64 = (bytes: Uint8Array, k: number): string => {
  let binary = "\0".repeat(k);
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};
const urlSafe = (b: string): string => b.replace(/\+/g, "-").replace(/\//g, "_");

/**
 * The forms of `v` the scrub matches (k.privacy Copies and Base64), not folded, each with the count of characters its
 * mark takes in before and after it (0 or 1; a mark that takes one after also takes the `=` right after that):
 * the value; its NFC and its NFD where they differ; and, unless it holds a lone surrogate (its UTF-8 would hold U+FFFD
 * and not be the value), from base64 of its UTF-8 in the standard and the URL-safe alphabet and, from 8 bytes, the hex
 * of those bytes. Under 8 bytes base64 is the padded encoding, whole. From 8 bytes it is, for each alignment k of 0, 1
 * and 2 (the value's first byte at a byte offset of k modulo 3), the core: the characters whose six bits all come from
 * the value's bytes, indexes ⌈8k/6⌉ to ⌊8(k+n)/6⌋ − 1 of the encoding of k filler bytes then the value, taking in the
 * character before it when 8k mod 6 ≠ 0 and the one after it when 8(k+n) mod 6 ≠ 0. A form may repeat.
 */
export function formsOf(v: string): [string, number, number][] {
  const forms: [string, number, number][] = [[v, 0, 0]];
  const nfc = v.normalize("NFC");
  const nfd = v.normalize("NFD");
  if (nfc !== v) forms.push([nfc, 0, 0]);
  if (nfd !== v && nfd !== nfc) forms.push([nfd, 0, 0]);
  if (v === "" || LONE.test(v)) return forms;
  const bytes = UTF8.encode(v);
  const n = bytes.length;
  if (n < 8) {
    const b = base64(bytes, 0);
    forms.push([b, 0, 0], [urlSafe(b), 0, 0]);
    return forms;
  }
  let hex = "";
  for (const b of bytes) hex += (HEX[b >> 4] ?? "") + (HEX[b & 15] ?? "");
  forms.push([hex, 0, 0]);
  for (let k = 0; k < 3; k++) {
    const core = base64(bytes, k).slice(Math.ceil((8 * k) / 6), Math.floor((8 * (k + n)) / 6));
    const before = (8 * k) % 6 === 0 ? 0 : 1;
    const after = (8 * (k + n)) % 6 === 0 ? 0 : 1;
    forms.push([core, before, after], [urlSafe(core), before, after]);
  }
  return forms;
}
