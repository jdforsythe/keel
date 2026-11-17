const UTF8 = new TextEncoder();
const UNPAIRED = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/**
 * The written forms of `v`, each with its padding count, not folded: as is, `JSON.stringify` escaping,
 * `encodeURIComponent` (none for a value with a lone surrogate), and base64 of its UTF-8 bytes. Under 8 bytes that is
 * the padded form only; from 8 bytes (11 or more characters, too long to stand in ordinary text by chance) the unpadded
 * standard and base64url forms, which take in the padding that follows them.
 */
export function formsOf(v: string): [string, number][] {
  const bytes = UTF8.encode(v);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const padded = btoa(binary);
  const forms: [string, number][] = [
    [v, 0],
    [JSON.stringify(v).slice(1, -1), 0],
  ];
  if (!UNPAIRED.test(v)) forms.push([encodeURIComponent(v), 0]);
  if (bytes.length < 8) forms.push([padded, 0]);
  else {
    const pad = (3 - (bytes.length % 3)) % 3;
    const b = padded.slice(0, padded.length - pad);
    forms.push([b, pad], [b.replace(/\+/g, "-").replace(/\//g, "_"), pad]);
  }
  return forms;
}
