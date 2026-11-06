/**
 * Build a template once (compiler-hoisted static HTML). It must have exactly one root element; the
 * compiler emits one template per root. `html` is compiler output, never app data.
 */
export function template(html: string): HTMLTemplateElement {
  const t = document.createElement("template");
  t.innerHTML = html;
  if (t.content.children.length !== 1) throw new Error("k.runtime: template() needs exactly one root element");
  return t;
}
