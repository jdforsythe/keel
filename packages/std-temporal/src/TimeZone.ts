import { s } from "@keel/schema";
import { pinnedZones } from "./internal/pinnedZones.ts";

const intlAccepts = (zone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

/**
 * `UTC` or a Zone or Link name of the pinned IANA tz release, spelled exactly as there, that `Intl.DateTimeFormat`
 * accepts (std.temporal); kept as written and registered as `temporal.TimeZone`. `gen` draws from the pinned Zone
 * names, so one seed gives the same zones on every host.
 */
export const TimeZone = s.format("temporal.TimeZone", s.string(), {
  check: (v) => v === "UTC" || (pinnedZones().names.has(v) && intlAccepts(v)),
  gen: {
    from: s.int({ min: 0, max: 999 }),
    map: (k) => {
      const zones = pinnedZones().gen;
      return zones[k % zones.length] ?? "UTC";
    },
  },
});
export type TimeZone = s.infer<typeof TimeZone>;

s.register("temporal.TimeZone", TimeZone);
