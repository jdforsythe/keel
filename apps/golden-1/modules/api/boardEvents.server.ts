import { channelRoute } from "@keel/std-channels/server";
import { boardChannel } from "./boardChannel.ts";
import { boardStores } from "./boardStores.ts";

/** The board channel's event stream: every caller is a member, since the board is public. */
export const boardEvents = channelRoute(boardChannel, {
  id: "api.boardEvents",
  stores: boardStores,
  member: () => true,
});
