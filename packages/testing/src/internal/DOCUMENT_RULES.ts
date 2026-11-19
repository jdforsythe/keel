/** The axe-core rules a `renderRoute` page runs and a component `render` does not (k.a11y Render checks). */
export const DOCUMENT_RULES: ReadonlySet<string> = new Set([
  "document-title",
  "html-has-lang",
  "landmark-one-main",
  "region",
  "bypass",
]);
