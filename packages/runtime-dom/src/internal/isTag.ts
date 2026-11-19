/** True when `el` is a `<tag>` element (HTML namespace names are lower case). */
export function isTag<K extends keyof HTMLElementTagNameMap>(el: Element, tag: K): el is HTMLElementTagNameMap[K] {
  return el.localName === tag;
}
