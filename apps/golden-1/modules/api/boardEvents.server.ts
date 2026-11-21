import type { Ctx } from "@keel/ctx";
import { channelRoute } from "@keel/std-channels/server";
import { api } from "./api.contract.ts";
import { boardChannel } from "./boardChannel.schema.ts";
import { boardStores } from "./boardStores.ts";
import { removal } from "./removal.server.ts";

/**
 * The stores the board channel watches: the board and the store of `api.removal`. `channelRoute` looks for stores among
 * the values of this object, so the workflow's store is listed itself, not inside its `removal.stores(ctx)`.
 */
function watched(ctx: Ctx) {
  return { ...boardStores(), removal: removal.stores(ctx).store };
}

/** The board channel's event stream: every caller is a member, since the board is public. A save of the board or of `api.removal` reaches it. */
export const boardEvents = channelRoute(api, boardChannel, {
  id: "api.boardEvents",
  stores: watched,
  member: () => true,
});
