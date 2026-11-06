/** Start tags that implicitly close an open `<p>` (HTML parsing, "in body" insertion mode). */
const CLOSES_P: ReadonlySet<string> = new Set(
  "address article aside blockquote details dialog div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr main menu nav ol p pre search section table ul".split(
    " ",
  ),
);
/** Table parts and the parents the parser keeps them under without inserting or dropping nodes. */
const TABLE_PARTS: ReadonlyMap<string, readonly string[]> = new Map(
  Object.entries({
    caption: ["table"],
    col: ["colgroup"],
    colgroup: ["table"],
    tbody: ["table"],
    td: ["tr"],
    tfoot: ["table"],
    th: ["tr"],
    thead: ["table"],
    tr: ["tbody", "thead", "tfoot"],
  }),
);
const NO_SELF_NEST: ReadonlySet<string> = new Set(["a", "button", "dd", "dt", "form", "li", "option", "optgroup"]);
const HEADINGS: ReadonlySet<string> = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/**
 * Whether `<parent><child>` survives the HTML parser unchanged inside one template. When it does not
 * (the parser would close, move, insert, or drop elements), the compiler clones the child from its own
 * template and inserts it with the DOM instead, so the rendered tree always equals the JSX tree.
 */
export function canNest(parent: string, child: string): boolean {
  if (parent === "p" && CLOSES_P.has(child)) return false;
  const allowed = TABLE_PARTS.get(child);
  if (allowed !== undefined && !allowed.includes(parent)) return false;
  if (parent === "table" && !TABLE_PARTS.has(child)) return false;
  if (parent === child && NO_SELF_NEST.has(child)) return false;
  if (HEADINGS.has(parent) && HEADINGS.has(child)) return false;
  if ((parent === "dd" || parent === "dt") && (child === "dd" || child === "dt")) return false;
  if (parent === "select" && child !== "option" && child !== "optgroup" && child !== "hr") return false;
  return true;
}
