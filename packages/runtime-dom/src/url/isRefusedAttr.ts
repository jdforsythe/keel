/**
 * rfc:0056: attributes the runtime never binds and static templates never render, whatever the value. An `on*`
 * name (any case) is an inline handler string; `href` on `<base>` would re-point every relative URL on the page,
 * including the entry script. `tag` is the element's local name.
 */
export function isRefusedAttr(tag: string, name: string): boolean {
  return /^on/i.test(name) || (tag.toLowerCase() === "base" && name.toLowerCase() === "href");
}
