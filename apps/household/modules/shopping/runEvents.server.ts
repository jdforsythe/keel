import { channelRoute } from "@keel/std-channels/server";
import { restock } from "./restock.server.ts";
import { runsChannel } from "./runsChannel.schema.ts";
import { shopping } from "./shopping.contract.ts";

/** The runs' event stream, open to a signed-in member: each save of the workflow store reaches it as `saved`. */
export const runEvents = channelRoute(shopping, runsChannel, {
  id: "shopping.runEvents",
  stores: (ctx) => ({ restock: restock.stores(ctx).store }),
  member: ({ user }) => user !== "",
});
