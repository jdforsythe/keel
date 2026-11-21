/** `<tag id="...">`, or `<tag>` without an id: how a message names an element. */
export function where(el: Element): string {
  const tag = el.tagName.toLowerCase();
  return el.id === "" ? `<${tag}>` : `<${tag} id="${el.id}">`;
}
