import { fitNames } from "@keel/schema/internal";

/**
 * E1818's message for a reached exempt-kind file (k.check-time Where it is reported): `<file> imports <entry>, check
 * and build time only`, `<file>`'s leading segments dropped one at a time behind one `.../` until the message is at
 * most `max` units, then its last segment keeping its first units and `...` (`fitNames`).
 */
export function reachedMessage(file: string, entry: string, max = 89): string {
  const tail = ` imports ${entry}, check and build time only`;
  const segs = file.split("/");
  for (let k = 0; k < segs.length; k++) {
    const m = `${k === 0 ? "" : ".../"}${segs.slice(k).join("/")}${tail}`;
    if (m.length <= max) return m;
  }
  const lead = segs.length > 1 ? ".../" : "";
  return fitNames(([s]) => `${lead}${s ?? ""}${tail}`, [segs.at(-1) ?? ""], max);
}
