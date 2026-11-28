/**
 * rfc:0056, rfc:0058: attributes the runtime never binds and static templates never render, whatever the value.
 * An `on*` name (any case) is an inline handler string; `href` on `<base>` would re-point every relative URL on
 * the page, including the entry script; `http-equiv` on `<meta>` sets a document header (`refresh` redirects,
 * `set-cookie`, `content-security-policy`), which the server owns. `tag` is the element's local name.
 */
export function isRefusedAttr(tag: string, name: string): boolean {
  if (/^on/i.test(name)) return true;
  const t = tag.toLowerCase();
  const n = name.toLowerCase();
  return (t === "base" && n === "href") || (t === "meta" && n === "http-equiv");
}
