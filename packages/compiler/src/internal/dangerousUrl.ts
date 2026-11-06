/** True for a `javascript:`, `vbscript:` or `data:` URL, ignoring case, whitespace and control characters. */
export function dangerousUrl(value: string): boolean {
  let s = "";
  for (const ch of value) if (ch.charCodeAt(0) > 0x20) s += ch.toLowerCase();
  return /^(?:javascript|vbscript|data):/.test(s);
}
