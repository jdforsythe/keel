import { channel } from "@keel/std-channels";
import { ListParams } from "./ListParams.schema.ts";

/** The list's change stream: each member's page hears that the list changed and re-reads it through its own API call. */
export const listChannel = channel("shopping.live", { path: "/api/items/events", params: ListParams });
