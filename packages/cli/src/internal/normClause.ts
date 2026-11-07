/**
 * Clause text as the ledger compares it (k.testing Ledger): Markdown backticks dropped, typographic quotes made
 * straight, whitespace collapsed, lower case.
 */
export function normClause(text: string): string {
  return text.replaceAll("`", "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}
