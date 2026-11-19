const UTF8 = new TextEncoder();
const json = (x: string): string => JSON.stringify(x).slice(1, -1);

/**
 * The written forms of `v`, each with its padding count, not folded: as is; JSON-escaped, again with `\u` for each
 * non-ASCII unit, and twice (JSON inside a JSON string); `encodeURIComponent`, once and twice over, `encodeURI` and
 * form-encoded (`URLSearchParams`, `+` for a space), none for a value with a lone surrogate; and base64 of its UTF-8
 * bytes. A value of letters, digits, `_`, `.` and `-` only has no other text form. Under 8 bytes base64 is the padded
 * form only; from 8 bytes (11 or more characters, too long to stand in ordinary text by chance) the unpadded standard
 * and base64url forms, which take in the padding that follows them.
 */
export function formsOf(v: string): [string, number][] {
  const bytes = UTF8.encode(v);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const padded = btoa(binary);
  const texts = [v];
  if (!/^[\w.-]*$/.test(v)) {
    const j = json(v);
    texts.push(
      j,
      json(j),
      j.replace(/[^\0-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`),
    );
    // A lone surrogate has no URL form: `encodeURIComponent` throws on it.
    try {
      const u = encodeURIComponent(v);
      texts.push(u, encodeURI(v), encodeURIComponent(u), `${new URLSearchParams([["", v]])}`.slice(1));
    } catch {}
  }
  const short = bytes.length < 8;
  const pad = short ? 0 : (3 - (bytes.length % 3)) % 3;
  const b = padded.slice(0, padded.length - pad);
  const forms = texts.map((f): [string, number] => [f, 0]);
  forms.push([b, pad], [short ? b : b.replace(/\+/g, "-").replace(/\//g, "_"), pad]);
  return forms;
}
