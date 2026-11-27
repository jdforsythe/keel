/** An executable script element: any but a data block (`type="application/json"` and the like). */
const SCRIPT = /<script\b(?![^>]*\btype=["']?application\/(?:ld\+)?json)[^>]*>[\s\S]*?<\/script\s*>/gi;
const PRELOAD = /<link\b[^>]*\brel=["']?modulepreload["']?[^>]*>/gi;

/** A document's HTML with no script the page would run: what a browser with scripts off executes of it. */
export function withoutScripts(html: string): string {
  return html.replace(SCRIPT, "").replace(PRELOAD, "");
}
