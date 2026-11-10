/** Canonical duration text of an integer `ms`: `PT0S`, else `-`?`PT`, `<h>H`, `<m>M`, `<s>S` or `<s>.<mmm>S`, nonzero parts only. */
export function durationText(ms: number): string {
  const a = Math.abs(ms);
  const h = Math.floor(a / 36e5);
  const m = Math.floor(a / 6e4) % 60;
  const s = Math.floor(a / 1e3) % 60;
  const f = a % 1e3;
  if (a === 0) return "PT0S";
  const sec = s || f ? `${s}${f ? `.${String(f).padStart(3, "0")}` : ""}S` : "";
  return `${ms < 0 ? "-" : ""}PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${sec}`;
}
