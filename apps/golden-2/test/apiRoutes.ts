import { routeTable } from "@keel/router";
import { routes as health } from "@keel/std-health/routes";
import { routes as sessions } from "@keel/std-sessions/routes";
import { routes as accounts } from "../modules/accounts/routes.ts";
import { routes as kitchen } from "../modules/kitchen/routes.ts";

/** The `api` deployable's route table as its generated entry merges it: the `accounts` and `kitchen` modules' routes and the `health` and `sessions` stdlib modules'. */
export const apiRoutes = routeTable(accounts, kitchen, health, sessions);
