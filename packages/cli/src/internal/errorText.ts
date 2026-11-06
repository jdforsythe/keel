/** First line of a thrown value, for an internal-error reply. */
export function errorText(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  return (text.split("\n")[0] ?? "").slice(0, 200);
}
