const URL_ATTRS = new Set(["href", "src", "action", "formaction", "xlink:href", "poster", "ping"]);
/** Raw-HTML sinks: no scheme makes them safe, so any dynamic value is replaced. */
const HTML_ATTRS = new Set(["srcdoc"]);
const ALLOWED = new Set(["http", "https", "mailto", "tel"]);
const SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

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

/**
 * k.compiler URL rule: for a URL attribute (`href`, `src`, `action`, `formaction`, `xlink:href`, `poster`,
 * and each space-separated URL of `ping`), a value whose scheme is not http, https, mailto, or tel becomes
 * `about:blank`. Relative, fragment, and query values pass. Scheme detection mirrors the URL parser:
 * leading C0/space is trimmed, tab/CR/LF are ignored. `srcdoc` is raw HTML (k.compiler: no raw HTML outside
 * `unsafe`), so any value becomes `about:blank`. Other names return `value` unchanged. Shared with the
 * compiler's server renderer.
 */
export function safeUrl(name: string, value: string): string {
  const n = name.toLowerCase();
  if (HTML_ATTRS.has(n)) return "about:blank";
  if (!URL_ATTRS.has(n)) return value;
  const urls = n === "ping" ? value.split(/[\t\n\f\r ]+/).filter((u) => u !== "") : [value];
  return urls.every(allowed) ? value : "about:blank";
}
