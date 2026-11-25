import type { Snapshot } from "@keel/store";
import type { RaceRecord } from "./RaceRecord.schema.ts";
import type { RaceReport } from "./RaceReport.ts";
import type { Ref } from "./Ref.ts";
import { refOf } from "./internal/refOf.ts";

/**
 * The `conflicts.race` records of `found` at `path`, the file the analysis read: one E2701 per race, then one W2702 per
 * unchecked entry, named from its store's snapshot in `server` (by store id, as `replayGroup` returns it).
 */
export function raceRecords(
  path: string,
  found: RaceReport,
  server: { readonly [store: string]: Snapshot<unknown> },
): RaceRecord[] {
  const named = (store: string, id: number): Ref => {
    const e = server[store]?.log.find((x) => x.id === id);
    return e === undefined ? { id, name: "" } : refOf(e);
  };
  return [
    ...found.races.map(
      (r): RaceRecord => ({
        kind: "conflicts.race",
        code: "E2701",
        path,
        store: r.store,
        entry: r.entry,
        against: [...r.against],
        reason: r.kind,
      }),
    ),
    ...found.unchecked.map(
      (u): RaceRecord => ({
        kind: "conflicts.race",
        code: "W2702",
        path,
        store: u.store,
        entry: named(u.store, u.id),
        against: [],
        reason: u.reason,
      }),
    ),
  ];
}
