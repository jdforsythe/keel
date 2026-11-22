import { channel } from "@keel/std-channels";
import { ListParams } from "./ListParams.schema.ts";

/** The weekly runs' change stream: a member's setup page hears that a run moved and re-reads it. */
export const runsChannel = channel("shopping.runsLive", { path: "/api/restock/events", params: ListParams });
