/** `s`'s first `n` UTF-16 units, one fewer when the last would be the first half of a surrogate pair. */
const head = (s: string, n: number): string => {
  const c = s.charCodeAt(n - 1);
  return s.slice(0, c >= 0xd800 && c <= 0xdbff ? n - 1 : n);
};

/**
 * E1807's message `<path>: <what>` in at most `max` units (k.themes Token errors): the path drops leading segments
 * behind one `.../` until it fits, and a last segment still too long keeps its first units and `...`, so `: <what>`
 * is never cut.
 */
export function fitTokenMessage(path: readonly string[], what: string, max = 89): string {
  const tail = `: ${what}`;
  const whole = `${path.join(".")}${tail}`;
  if (whole.length <= max) return whole;
  for (let k = 1; k < path.length; k++) {
    const cut = `.../${path.slice(k).join(".")}${tail}`;
    if (cut.length <= max) return cut;
  }
  const last = path.at(-1) ?? "";
  const lead = path.length > 1 ? ".../" : "";
  const room = Math.max(1, max - lead.length - tail.length - 3);
  return `${lead}${head(last, room)}...${tail}`;
}
