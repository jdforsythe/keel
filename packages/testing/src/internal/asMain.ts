/**
 * Make the page container the document's `main` landmark (`role="main"`) unless the chain renders its own `main`, as
 * the server wraps a document's chain in `<main>` unless it already has one (k.server, k.a11y Render checks).
 */
export function asMain(container: Element): void {
  const own = container.querySelector('main, [role="main"]') !== null;
  if (own && container.hasAttribute("role")) container.removeAttribute("role");
  else if (!own && container.getAttribute("role") !== "main") container.setAttribute("role", "main");
}
