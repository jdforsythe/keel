import { trustedHtml } from "../internal/trustedHtml.ts";

/**
 * Build a template once (compiler-hoisted static HTML). It must have exactly one root element; the
 * compiler emits one template per root. `html` is compiler output, never app data; where Trusted Types exist it
 * passes through the policy `keel`.
 */
export function template(html: string): HTMLTemplateElement {
  const t = document.createElement("template");
  Reflect.set(t, "innerHTML", trustedHtml(html));
  if (t.content.children.length !== 1) throw new Error("k.runtime: template() needs exactly one root element");
  return t;
}
