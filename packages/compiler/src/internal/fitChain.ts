import { shortPath } from "./shortPath.ts";

/**
 * Files joined by ` -> ` in at most `room` UTF-16 code units: when they do not fit, the files between the first and the
 * last become one `...`, then the first loses leading segments, then the last (k.boundary E1004's message).
 */
export function fitChain(files: readonly string[], room: number): string {
  const join = (f: readonly string[]): string => f.join(" -> ");
  const full = join(files);
  if (full.length <= room || files.length === 0) return full;
  const first = files[0] ?? "";
  const last = files[files.length - 1] ?? "";
  const ends = files.length > 2 ? [first, "...", last] : [first, last];
  if (join(ends).length <= room) return join(ends);
  const middle = ends.length === 3 ? ends[1] : undefined;
  const fixed = (middle === undefined ? 0 : 4 + middle.length) + 4;
  const shortFirst = shortPath(first, Math.max(0, room - fixed - last.length));
  const shortLast = shortPath(last, Math.max(0, room - fixed - shortFirst.length));
  return join(middle === undefined ? [shortFirst, shortLast] : [shortFirst, middle, shortLast]);
}
