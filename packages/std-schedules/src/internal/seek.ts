import type { Cron } from "./Cron.ts";
import { civil } from "./civil.ts";
import { fireAt } from "./fireAt.ts";
import { localMinute } from "./localMinute.ts";

const MIN = 60_000;

/**
 * The fire time (ms) of `c` in `zone` nearest `t`: the first after `t` (`dir` 1) or the last at or before it (`dir`
 * -1), searching eleven years; undefined when none. Fire times are minutes, and a wall time's fire time grows with
 * it, so the first wall time in scan order past `t` is the answer.
 */
export function seek(c: Cron, zone: string, t: number, dir: 1 | -1): number | undefined {
  const tm = Math.floor(t / MIN);
  const lt = localMinute(zone, tm);
  const hs = dir > 0 ? c.h : [...c.h].reverse();
  const ms = dir > 0 ? c.mi : [...c.mi].reverse();
  for (let k = 0, d = Math.floor(lt / 1440); k < 4018; k++, d += dir) {
    const [, mo, day] = civil(d);
    const a = c.dom.includes(day);
    const b = c.dow.includes((((d + 4) % 7) + 7) % 7);
    if (!c.mon.includes(mo) || !(c.domR && c.dowR ? a || b : a && b)) continue;
    for (const h of hs)
      for (const m of ms) {
        const w = d * 1440 + h * 60 + m;
        if (w <= lt) {
          if (dir > 0) continue;
          return fireAt(zone, w) * MIN;
        }
        const f = fireAt(zone, w);
        if (dir > 0 ? f > tm : f <= tm) return f * MIN;
      }
  }
  return undefined;
}
