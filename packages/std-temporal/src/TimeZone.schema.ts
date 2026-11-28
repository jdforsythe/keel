import { s } from "@keel/schema";
import { pinnedZones } from "./internal/pinnedZones.ts";

/**
 * `UTC` or a Zone or Link name of the pinned IANA tz release, spelled exactly as there (std.temporal); kept as written
 * and registered as `temporal.TimeZone`. `parse` and `gen` read only the pinned list, never the host's `Intl`, so a
 * value parses and one seed gives the same zones on every host.
 */
export const TimeZone = s.format("temporal.TimeZone", s.string(), {
  check: (v) => v === "UTC" || pinnedZones().names.has(v),
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
