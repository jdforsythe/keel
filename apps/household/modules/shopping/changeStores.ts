import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";
import { Changes } from "./Changes.schema.ts";

/**
 * A server store the list's writes bump after each commit to Postgres. The list itself is app data in Postgres, which a
 * channel cannot watch; a save of this store is what sends `saved` to every member's stream.
 */
export const changeStores = () => {
  const changes = store(Changes, { n: 0 }, { id: "shopping.changes" });
  const bump = transaction(changes, "shopping.changes.bump", s.object({}), (state) => ({ n: state.n + 1 }));
  return { changes, bump };
};
