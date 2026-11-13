/**
 * Give `doc` the user-agent rule `[hidden] { display: none }` once (happy-dom has no UA stylesheet), so axe-core,
 * which reads computed styles, skips hidden content as a browser does.
 */
export function uaHidden(doc: Document): void {
  if (doc.querySelector("style[data-k-ua]") !== null) return;
  const style = doc.createElement("style");
  style.setAttribute("data-k-ua", "");
  style.textContent = "[hidden]:not([hidden=until-found]){display:none}";
  (doc.head ?? doc.documentElement).append(style);
}
