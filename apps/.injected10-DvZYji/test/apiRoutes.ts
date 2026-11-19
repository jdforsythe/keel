import { manifest } from "@keel/router";
import { routes as api } from "../modules/api/routes.ts";
import { routes as digest } from "../modules/digest/routes.ts";

/** The `api` deployable's route table as its generated entry merges it: the `api` and `digest` modules' routes. */
export const apiRoutes = manifest({ ...api.routes, ...digest.routes });
