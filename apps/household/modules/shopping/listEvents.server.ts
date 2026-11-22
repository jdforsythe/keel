import { channelRoute } from "@keel/std-channels/server";
import { listChannel } from "./listChannel.schema.ts";
import { shopping } from "./shopping.contract.ts";
import { shoppingDb } from "./shoppingDb.server.ts";

/**
 * The list's event stream: open to a signed-in member only; a visitor's open is closed `denied` at once. It follows the
 * list's database, so each committed change of the list reaches every open member stream as `changed`.
 */
export const listEvents = channelRoute(shopping, listChannel, {
  id: "shopping.events",
  follows: [shoppingDb],
  member: ({ user }) => user !== "",
});
