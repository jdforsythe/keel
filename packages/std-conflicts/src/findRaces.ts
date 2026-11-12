import { type SessionGroup, replayGroup } from "@keel/std-sessions/group";
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
    const parsed = parse(replay.server[id]);
    for (const factory of options.stores) {
      // The store's own `restore` validates the stored value; one it refuses is not examined (null: `withFactory`
      // throws on undefined).
      const found = withFactory(factory, (made) => {
        const st = made.stores.find((x) => x.id === id);
        return st?.restore(parsed).ok === true ? checkStore(st, made.txs, st.snapshot({ meta: true })) : null;
      });
      if (found === null) continue;
      races.push(...found.races);
      unchecked.push(...found.unchecked);
      break;
    }
  }
  return { replay, races, unchecked };
}

// A stored value as JSON text is parsed; text that is not JSON is `undefined`, which no store restores.
const parse = (raw: unknown): unknown => {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return undefined;
  }
};
