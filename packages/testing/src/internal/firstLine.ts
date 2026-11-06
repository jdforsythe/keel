/** First line of an error's message (or of its string form), for one-line diagnostics. */
export function firstLine(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.split("\n")[0] ?? "";
}
