import { manifest } from "@keel/router";
import HealthView from "./HealthView.ts";
import { health } from "./health.contract.ts";
import { loadHealth } from "./loadHealth.server.ts";

/** The `@keel/std-health` route table (std.health): the binding of `health.status`, for a deployable's `routeTable`. */
export const routes = manifest(health, { "health.status": { component: HealthView, loader: loadHealth } });
