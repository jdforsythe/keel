import { service } from "@keel/services";
import { kitchen } from "../kitchen/kitchen.contract.ts";

/** A typed client for the `kitchen` contract's API entries; the topology resolves where `kitchen` runs. */
export const kitchenApi = service({ contract: kitchen });
