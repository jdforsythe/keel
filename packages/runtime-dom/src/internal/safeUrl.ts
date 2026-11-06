const URL_ATTRS = new Set(["href", "src", "action", "formaction", "xlink:href"]);
const ALLOWED = new Set(["http", "https", "mailto", "tel"]);
const SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/**
 * k.compiler URL rule: for a URL attribute (`href`, `src`, `action`, `formaction`), a value whose scheme
 * is not http, https, mailto, or tel becomes `about:blank`. Relative, fragment, and query values pass.
 * Scheme detection mirrors the URL parser: leading C0/space is trimmed, tab/CR/LF are ignored.
 * Any other attribute name returns `value` unchanged. Shared with the compiler's server renderer.
 */
export function safeUrl(name: string, value: string): string {
  if (!URL_ATTRS.has(name.toLowerCase())) return value;
  let start = 0;
  while (start < value.length && value.charCodeAt(start) <= 0x20) start++;
  let probe = "";
  for (let i = start; i < value.length && probe.length < 64; i++) {
    const c = value.charCodeAt(i);
    if (c === 0x09 || c === 0x0a || c === 0x0d) continue;
    probe += value[i];
  }
  const m = SCHEME.exec(probe);
  if (m === null) return value;
  return ALLOWED.has((m[1] ?? "").toLowerCase()) ? value : "about:blank";
}
