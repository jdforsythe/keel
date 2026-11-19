/**
 * A record id as one part of an element id: percent-encoded, so it holds no whitespace or quote and two ids stay
 * two parts. Minted ids (uuids) and fixture ids such as `t1` pass through unchanged.
 */
export function idPart(id: string): string {
  return encodeURIComponent(id);
}
