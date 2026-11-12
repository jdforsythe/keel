import { type Store, stores } from "@keel/store";
import type { JsonObject } from "./JsonObject.ts";

/**
 * Every live store paired with its replay seed: its value in `state`, else its `initial` (the base its undo replays
 * from). Seeding every store keeps a replay from reading what an earlier run left, and `dispose` puts each back.
 */
export function seededState(state: JsonObject): (readonly [Store<unknown>, unknown])[] {
  const out: (readonly [Store<unknown>, unknown])[] = [];
  for (const [id, st] of stores()) out.push([st, Object.hasOwn(state, id) ? state[id] : st.snapshot().initial]);
  return out;
}
