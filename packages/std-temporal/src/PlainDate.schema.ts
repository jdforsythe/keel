import { s } from "@keel/schema";
import { isInstant } from "./internal/isInstant.ts";
import { iso } from "./internal/iso.ts";

/**
 * A proleptic Gregorian date, `YYYY-MM-DD` in years 0001 to 9999, the value of `<input type="date">` (std.temporal);
 * registered as `temporal.PlainDate`. String order is date order. Generated dates reach both ends and February 29.
 */
export const PlainDate = s.format("temporal.PlainDate", s.string(), {
  check: (v) => isInstant(`${v}T00:00:00.000Z`),
  gen: {
    from: s.object({ day: s.int({ min: -719162, max: 2932896 }), leap: s.int({ min: 0, max: 15 }) }),
    // leap 0 asks for February 29 of the day's year; parse drops it in a common year
    map: ({ day, leap }) => {
      const d = iso(day * 864e5).slice(0, 10);
      return leap === 0 ? `${d.slice(0, 5)}02-29` : d;
    },
  },
});
export type PlainDate = s.infer<typeof PlainDate>;

s.register("temporal.PlainDate", PlainDate);
