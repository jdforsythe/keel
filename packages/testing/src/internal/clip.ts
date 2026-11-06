/** Shorten `text` to at most `max` characters, marking the cut with `...`. */
export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 3))}...`;
}
