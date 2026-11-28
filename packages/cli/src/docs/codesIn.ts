/** Every diagnostic code a text cites, once each, sorted. */
export function codesIn(text: string): string[] {
  return [...new Set(text.match(/\b[EWIR]\d{4}\b/g) ?? [])].sort();
}
