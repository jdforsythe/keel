import { module } from "@keel/compiler";

/** The `@keel/std-temporal` library manifest (std.temporal, k.library): a module that holds, parses or formats instants, dates or durations lists the package in `deps`. */
export default module({
  id: "temporal",
  deps: ["@keel/std-i18n"],
  capabilities: [],
  public: {
    exports: [
      "addDays",
      "DateStyle",
      "Duration",
      "durationMs",
      "durationOf",
      "epochMs",
      "formatDate",
      "formatDuration",
      "formatInstant",
      "Instant",
      "instantOf",
      "PlainDate",
      "plainDateOf",
      "TemporalError",
      "TimeZone",
      "UnitStyle",
      "UTC",
    ],
  },
});
