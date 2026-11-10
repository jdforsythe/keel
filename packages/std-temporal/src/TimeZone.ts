import { s } from "@keel/schema";

/**
 * `UTC` or an IANA zone name `Intl.DateTimeFormat` accepts and reports back unchanged (std.temporal); registered as
 * `temporal.TimeZone`. `utc` and aliases the runtime renames fail with rule `format`.
 */
export const TimeZone = s.format("temporal.TimeZone", s.string(), {
  check: (v) => v === "UTC" || new Intl.DateTimeFormat("en-US", { timeZone: v }).resolvedOptions().timeZone === v,
  gen: {
    from: s.int({ min: 0, max: 999 }),
    map: (k) => {
      const zones = Intl.supportedValuesOf("timeZone");
      return (k && zones[k % zones.length]) || "UTC";
    },
  },
});
export type TimeZone = s.infer<typeof TimeZone>;

s.register("temporal.TimeZone", TimeZone);
