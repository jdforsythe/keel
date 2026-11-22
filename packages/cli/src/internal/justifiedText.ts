/** An entry's `original` as an E1725 message shows it: on one line, the first 40 characters. */
export function justifiedText(original: string): string {
  const flat = original.replace(/\s+/g, " ").trim();
  return flat.length > 40 ? `${flat.slice(0, 37)}...` : flat;
}
