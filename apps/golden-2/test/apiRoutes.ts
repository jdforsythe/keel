import { manifest } from "@keel/router";
import { routes as accounts } from "../modules/accounts/routes.ts";
import { routes as kitchen } from "../modules/kitchen/routes.ts";

/** The `api` deployable's route table as its generated entry merges it: the `accounts` and `kitchen` modules' routes. */
export const apiRoutes = manifest({ ...accounts.routes, ...kitchen.routes });
