/** The hidden line an issue body opens with: it carries the fingerprint (12 hex digits) and nothing else. */
export function sessionMarker(fingerprint: string): string {
  return `<!-- keel-session:${fingerprint} -->`;
}
