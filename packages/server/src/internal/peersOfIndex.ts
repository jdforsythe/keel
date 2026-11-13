/** The origins of a built `index.html`'s `<meta name="keel-peer" content>` tags (k.hosting Peers), in document order. */
export function peersOfIndex(html: string): string[] {
  const out: string[] = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/\bname=["']keel-peer["']/i.test(tag)) continue;
    const content = /\bcontent=["']([^"']+)["']/i.exec(tag)?.[1];
    if (content !== undefined && !out.includes(content)) out.push(content);
  }
  return out;
}
