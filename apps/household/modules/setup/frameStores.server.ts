import type { Ctx } from "@keel/ctx";
import { restockStores } from "../shopping/restockStores.server.ts";
import { householdStores } from "./householdStores.ts";

/**
 * The stores the frame and the setup page under it read: the household's name and the weekly runs. Both loaders name
 * this one factory, so a request opens each store once (k.server Server state).
 */
export const frameStores = (ctx: Ctx) => ({ ...householdStores(), ...restockStores(ctx) });
