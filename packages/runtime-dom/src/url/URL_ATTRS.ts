/**
 * Attributes whose value is a URL (k.compiler escaping by context), lowercase. `ping` holds a space-separated
 * list. The one definition: the runtime (`attr`, `prop`, `@keel/ui`) and the compiler's E1003/E1501 read it.
 */
export const URL_ATTRS: ReadonlySet<string> = new Set([
  "href",
  "src",
  "action",
  "formaction",
  "xlink:href",
  "poster",
  "ping",
]);
