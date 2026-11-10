/** Milliseconds a duration text spells, read leniently (`PT90M` is 5400000); `NaN` when it is not `-`?`PT[<h>H][<m>M][<s>[.<mmm>]S]`. */
export function durationValue(v: string): number {
  const m = /^(-?)PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:\.(\d{3}))?S)?$/.exec(v);
  if (!m) return Number.NaN;
  const ms = ((Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)) * 60 + Number(m[4] ?? 0)) * 1e3 + Number(m[5] ?? 0);
  return m[1] ? -ms : ms;
}
