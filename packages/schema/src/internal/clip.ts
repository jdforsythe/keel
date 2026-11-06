/** Shorten text so a diagnostic message stays under 90 chars. */
export function clip(text: string, max = 40): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
