import { channelRoute } from "@keel/std-channels/server";
import { changeStores } from "./changeStores.ts";
import { listChannel } from "./listChannel.schema.ts";
import { shopping } from "./shopping.contract.ts";

/** The list's event stream: open to a signed-in member only; a visitor's open is closed `denied` at once. */
export const listEvents = channelRoute(shopping, listChannel, {
  id: "shopping.events",
  stores: changeStores,
  member: ({ user }) => user !== "",
});
