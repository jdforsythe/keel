/**
 * The containers of the `renderRoute` pages open now (k.user Testing: two harnesses over one `app` are open at once).
 * A page's axe check judges the document without the others, each its own browser's document.
 */
export const pageRoots: Set<Element> = new Set();
