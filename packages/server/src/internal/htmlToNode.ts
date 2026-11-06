/**
 * Parse rendered child HTML into a fragment for a component that calls `children()` and builds DOM. Needs a
 * DOM (happy-dom); without one it throws (the level's errorElement or a 500 renders).
 */
export function htmlToNode(html: string): Node {
  if (typeof document === "undefined")
    throw new Error("k.server: a component called children() but no DOM is available; return an HTML string");
  const t = document.createElement("template");
  t.innerHTML = html;
  return t.content;
}
