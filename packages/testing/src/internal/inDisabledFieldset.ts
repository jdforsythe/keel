/** True when `el` sits inside a `fieldset[disabled]`, other than inside that fieldset's first `legend` child. */
export function inDisabledFieldset(el: Element): boolean {
  let child: Element = el;
  for (let node = el.parentElement; node !== null; child = node, node = node.parentElement) {
    if (node.tagName.toLowerCase() !== "fieldset" || !node.hasAttribute("disabled")) continue;
    const legend = Array.from(node.children).find((c) => c.tagName.toLowerCase() === "legend");
    if (legend !== child) return true;
  }
  return false;
}
