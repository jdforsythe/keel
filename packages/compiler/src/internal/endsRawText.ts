/**
 * Whether literal `text` inside a `<tag>` raw-text element would end it early when parsed as HTML: `</tag` in
 * any case, or `<!--` in a script (the script-data escape states). rfc:0058.
 */
export function endsRawText(tag: string, text: string): boolean {
  const low = text.toLowerCase();
  return low.includes(`</${tag}`) || (tag === "script" && low.includes("<!--"));
}
