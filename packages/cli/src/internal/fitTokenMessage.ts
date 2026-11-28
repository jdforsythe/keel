import { fitNames } from "@keel/schema/internal";

/** A `<what>` holding a quoted name: the text up to its first `"`, the name, and the text from its last `"`. */
const QUOTED = /^([^"]*")(.*)("[^"]*)$/s;

/**
 * E1807's message `<path>: <what>` in at most `max` units (k.themes Token errors): the path drops leading segments
 * behind one `.../` until it fits; then its last segment, and a quoted name in `<what>` (`names no color token
 * "<name>"`), the longer first, keep their first units and `...` (`fitNames`), so no word of `: <what>` and neither
 * quote is cut.
 */
export function fitTokenMessage(path: readonly string[], what: string, max = 89): string {
  const tail = `: ${what}`;
  const whole = `${path.join(".")}${tail}`;
  if (whole.length <= max) return whole;
  for (let k = 1; k < path.length; k++) {
    const cut = `.../${path.slice(k).join(".")}${tail}`;
    if (cut.length <= max) return cut;
  }
  const lead = path.length > 1 ? ".../" : "";
  const last = path.at(-1) ?? "";
  const q = QUOTED.exec(what);
  if (q === null) return fitNames(([s]) => `${lead}${s ?? ""}${tail}`, [last], max);
  const [, before = "", name = "", after = ""] = q;
  return fitNames(([s, n]) => `${lead}${s ?? ""}: ${before}${n ?? ""}${after}`, [last, name], max);
}
