/** A name or text shortened to 24 characters for a one-line message. */
export function clip(s: string): string {
  return s.length > 24 ? `${s.slice(0, 21)}...` : s;
}
