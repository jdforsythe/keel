import { routeTable } from "@keel/router";
import { routes as app } from "../modules/app/routes.ts";
import { routes as members } from "../modules/members/routes.ts";
import { routes as receipts } from "../modules/receipts/routes.ts";
import { routes as setup } from "../modules/setup/routes.ts";
import { routes as shopping } from "../modules/shopping/routes.ts";

/** The `web` deployable's route table, as its generated entry joins it. */
export const routes = routeTable(app, members, receipts, setup, shopping);
