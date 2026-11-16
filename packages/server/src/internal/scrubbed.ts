/** Below this length a value is replaced only where it stands as a whole token. */
const SHORT = 3;
const literal = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const base64 = (s: string): string =>
  btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));

/**
 * `message` with each of `values` replaced by `mark` (k.privacy Server log), in each written form: as is, its
 * `encodeURIComponent` form, its `JSON.stringify` escaping (quotes, backslashes, newlines) and its whole-value UTF-8
 * base64, all matched case-insensitively, longest first. A value under 3 characters is replaced only as a whole token
 * (not inside a longer word or number), so the record stays readable and the mark does not show where it stood.
 */
export function scrubbed(message: string, values: ReadonlySet<string>, mark = "[pii]"): string {
  const forms = new Set<string>();
  for (const v of values)
    for (const f of [v, encodeURIComponent(v), JSON.stringify(v).slice(1, -1), base64(v)]) if (f !== "") forms.add(f);
  if (forms.size === 0) return message;
  const alts = [...forms]
    .sort((a, b) => b.length - a.length)
    .map((f) => (f.length < SHORT ? `(?<![\\p{L}\\p{N}_])${literal(f)}(?![\\p{L}\\p{N}_])` : literal(f)));
  return message.replace(new RegExp(alts.join("|"), "giu"), mark);
}
