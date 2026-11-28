/**
 * Attributes whose value is a URL (k.compiler escaping by context), lowercase. `ping`, `srcset` and
 * `imagesrcset` hold lists split at whitespace and commas; the SVG animation values `to`, `from`, `by` and
 * `values` (a `;` list) are policed on every element, whatever `attributeName` targets (rfc:0056). The one
 * definition: the runtime (`attr`, `prop`, `@keel/ui`) and the compiler's E1003/E1501 read it.
 */
export const URL_ATTRS: ReadonlySet<string> = new Set([
  "href",
  "src",
  "action",
  "formaction",
  "xlink:href",
  "poster",
  "ping",
  "data",
  "srcset",
  "imagesrcset",
  "to",
  "from",
  "by",
  "values",
]);
