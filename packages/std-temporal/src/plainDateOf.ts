import { formatDateTime } from "@keel/std-i18n";
import type { Instant } from "./Instant.schema.ts";
import { PlainDate } from "./PlainDate.schema.ts";
import type { TimeZone } from "./TimeZone.schema.ts";
import { UTC } from "./UTC.ts";
import { iso } from "./internal/iso.ts";

/**
 * The calendar date at `i` in `zone` (std.temporal). The zone's month and day pick the UTC date of `i`, the day before
 * or the day after. A date that would fall outside years 0001 to 9999 is the UTC date of `i`, the nearest bound.
 */
export function plainDateOf(i: Instant, zone: TimeZone): PlainDate {
  const t = Date.parse(i);
  const md = formatDateTime(t, "en-US", { timeZone: zone, month: "2-digit", day: "2-digit" }).replace("/", "-");
  let d = i.slice(0, 10);
  for (const c of [iso(t - 864e5), iso(t + 864e5)]) if (c.slice(-19, -14) === md) d = c.slice(0, -14);
  const r = PlainDate.parse(d);
  return r.ok ? r.value : plainDateOf(i, UTC);
}
