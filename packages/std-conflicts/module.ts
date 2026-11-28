import { module } from "@keel/compiler";

/** The `@keel/std-conflicts` library manifest (std.conflicts, k.library): a module that looks for races in a stored store lists the package in `deps`. */
export default module({
  id: "conflicts",
  deps: ["@keel/std-sessions"],
  capabilities: [],
  public: {
    exports: [
      "findRaces",
      "FindRacesOptions",
      "FindRacesResult",
      "Race",
      "RaceRecord",
      "raceRecords",
      "RaceReport",
      "races",
      "Ref",
      "StoresFactory",
      "Unchecked",
    ],
  },
});
