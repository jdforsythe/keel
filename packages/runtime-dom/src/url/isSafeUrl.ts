import { RAW_HTML_ATTRS } from "./RAW_HTML_ATTRS.ts";
import { URL_ATTRS } from "./URL_ATTRS.ts";

const ALLOWED: ReadonlySet<string> = new Set(["http", "https", "mailto", "tel"]);
const SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/** One URL: leading C0/space trimmed and tab/CR/LF ignored, as the URL parser does; no scheme means relative. */
const allowed = (value: string): boolean => {
  let start = 0;
  while (start < value.length && value.charCodeAt(start) <= 0x20) start++;
  let probe = "";
  for (let i = start; i < value.length && probe.length < 64; i++) {
    const c = value.charCodeAt(i);
    if (c === 0x09 || c === 0x0a || c === 0x0d) continue;
    probe += value[i];
  }
  const m = SCHEME.exec(probe);
  return m === null || ALLOWED.has((m[1] ?? "").toLowerCase());
};

/** List attributes and the separators between their items (rfc:0056). A `srcset` URL holding a comma is split too: conservative. */
const LISTS: ReadonlyMap<string, RegExp> = new Map([
  ["ping", /[\t\n\f\r ,]/],
  ["srcset", /[\t\n\f\r ,]/],
  ["imagesrcset", /[\t\n\f\r ,]/],
  ["values", /;/],
]);

/**
 * k.compiler URL rule as a predicate: true when attribute `name` (any case) may hold `value` unchanged.
 * For a URL attribute (`URL_ATTRS`; each item of a list attribute, `LISTS`), the scheme must be http, https,
 * mailto, or tel, or absent (relative, `//host`, `#fragment`, `?query`). One bad item makes the whole value
 * unsafe. A raw-HTML attribute (`srcdoc`) is never safe. Every other attribute is safe. The runtime renders an
 * unsafe value as `about:blank` (`safeUrl`); the compiler reports a literal one as E1003.
 */
export function isSafeUrl(name: string, value: string): boolean {
  const n = name.toLowerCase();
  if (RAW_HTML_ATTRS.has(n)) return false;
  if (!URL_ATTRS.has(n)) return true;
  const sep = LISTS.get(n);
  return (sep === undefined ? [value] : value.split(sep)).every(allowed);
}
