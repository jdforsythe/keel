/**
 * A clause's normal form (k.ledger-items Clause key), the one definition its key and a citation's match use: Markdown
 * backticks dropped, escaped (`\"`) and typographic quotes made straight, each run of white space one space, the ends
 * trimmed, lower case, and one final period dropped.
 */
export function normClause(text: string): string {
  const flat = text
    .replaceAll("`", "")
    .replaceAll('\\"', '"')
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return flat.endsWith(".") ? flat.slice(0, -1) : flat;
}
