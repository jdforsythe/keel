import { s } from "@keel/schema";

/**
 * The data of one removal instance (`removalChart`, `removal`): the list it removes. Optional only because a chart's
 * own `start` holds no list; `api.removeList` always starts an instance with one.
 */
export const RemovalData = s.object({ list: s.id("TodoList").optional() });
export type RemovalData = s.infer<typeof RemovalData>;
