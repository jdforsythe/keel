import { routeTable } from "@keel/router";
import { routes as sessions } from "@keel/std-sessions/routes";
import { routes as api } from "../modules/api/routes.ts";
import { routes as digest } from "../modules/digest/routes.ts";

/** The `api` deployable's route table as its generated entry merges it: the `api`, `digest` and `sessions` modules' routes. */
export const apiRoutes = routeTable(api, digest, sessions);
