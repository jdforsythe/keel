import { s } from "@keel/schema";
import { Cost } from "./Cost.schema.ts";

/** The payload of `trip.addCost`: the cost, its id and time minted from `ctx`, its shares worked out by the caller. */
export const AddCostPayload = s.object({ cost: Cost });
