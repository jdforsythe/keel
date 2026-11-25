import { routeTable } from "@keel/router";
import * as sessions from "@keel/std-sessions/routes";
import * as shifts from "../modules/shifts/routes.ts";

/** The `web` deployable's route table, joined as the generated entry joins it. */
export const webRoutes = routeTable(shifts.routes, sessions.routes);
