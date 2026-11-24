/** `text` as `parseMoney` reads it: NFKC, each `White_Space` character a space (ends not trimmed). */
export function normalized(text: string): string {
  return text.normalize("NFKC").replace(/\p{White_Space}/gu, " ");
}
