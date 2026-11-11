const fmts = new Map<string, Intl.DateTimeFormat>();

/** The wall-clock reading in `zone` at minute `i` after the epoch, as minutes after a 1970-01-01T00:00 wall clock. */
export function localMinute(zone: string, i: number): number {
  if (zone === "UTC") return i;
  let f = fmts.get(zone);
  if (f === undefined) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
    fmts.set(zone, f);
  }
  const p = new Map(f.formatToParts(i * 60_000).map((x) => [x.type, Number(x.value)]));
  const at = (k: Intl.DateTimeFormatPartTypes): number => p.get(k) ?? 0;
  return Date.UTC(at("year"), at("month") - 1, at("day"), at("hour"), at("minute")) / 60_000;
}
