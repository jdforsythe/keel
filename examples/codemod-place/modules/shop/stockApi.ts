import { service } from "@keel/services";
import { stock } from "../stock/stock.contract.ts";

/** A typed client for the `stock` module, wherever `topology.ts` places it. */
export const stockApi = service({ contract: stock });
