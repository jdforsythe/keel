import { service } from "@keel/services";
import { kitchen } from "./kitchen.service.ts";

/** A typed client for the `kitchen` endpoints; the topology resolves where `kitchen` runs. */
export const kitchenApi = service({ module: "kitchen", schema: kitchen });
