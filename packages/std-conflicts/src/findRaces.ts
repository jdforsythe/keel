import type { JsonValue } from "@keel/schema";
import { type SessionGroup, replayGroup } from "@keel/std-sessions/group";
import type { Snapshot } from "@keel/store";
import type { FindRacesOptions } from "./FindRacesOptions.ts";
import type { FindRacesResult } from "./FindRacesResult.ts";
import type { Race } from "./Race.ts";
import type { Unchecked } from "./Unchecked.ts";
import { checkStore } from "./internal/checkStore.ts";
import { withFactory } from "./internal/withFactory.ts";

/**
 * Replay a session group with `replayGroup` (std.multi) and run `races` on the final snapshot of every server store
 * that a factory in `stores` declares (by id), stores in id order. Returns the replay and the races found.
 */
export async function findRaces(group: SessionGroup, options: FindRacesOptions): Promise<FindRacesResult> {
  const replay = await replayGroup(group, { user: options.user, serve: options.serve });
  const races: Race[] = [];
  const unchecked: Unchecked[] = [];
  for (const id of Object.keys(replay.server).sort()) {
    const raw: unknown = replay.server[id];
    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!isSnapshot(parsed)) continue;
    for (const factory of options.stores) {
      const found = withFactory(factory, (made) => {
        const st = made.stores.find((x) => x.id === id);
        return st === undefined ? undefined : checkStore(st, made.txs, parsed);
      });
      if (found === undefined) continue;
      races.push(...found.races);
      unchecked.push(...found.unchecked);
      break;
    }
  }
  return { replay, races, unchecked };
}

const isSnapshot = (v: unknown): v is Snapshot<JsonValue> =>
  typeof v === "object" && v !== null && "state" in v && Array.isArray(Reflect.get(v, "log")) && "initial" in v;
