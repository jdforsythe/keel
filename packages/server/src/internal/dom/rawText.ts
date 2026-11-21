/**
 * Text of a `<script>` or `<style>` element, serialized raw (no character references) as browsers do, but never
 * able to end the element early. Script: `</script` (any case) becomes `<\/script` and `<!--` becomes `<\!--`,
 * the JSON-in-script escapes (equal inside a JS string or regex literal; the HTML tokenizer sees neither an end
 * tag nor the escaped state). Style: CSS has no such escape that keeps meaning everywhere, so text containing
 * `</style` (any case) throws.
 */
export function rawText(tag: string, data: string): string {
  if (tag === "script") return data.replace(/<(?=\/script)/gi, "<\\").replace(/<!--/g, "<\\!--");
  if (/<\/style/i.test(data)) throw new Error("k.server: <style> text contains </style");
  return data;
}
