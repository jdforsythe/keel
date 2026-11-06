const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function codePoint(n: number, fallback: string): string {
  return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : fallback;
}

/** Decode the JSX entities that matter for ids and names: a few named ones and numeric references. */
export function decodeEntities(raw: string): string {
  return raw.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, body: string) => {
    if (body.startsWith("#x")) return codePoint(Number.parseInt(body.slice(2), 16), m);
    if (body.startsWith("#")) return codePoint(Number.parseInt(body.slice(1), 10), m);
    return NAMED[body] ?? m;
  });
}
