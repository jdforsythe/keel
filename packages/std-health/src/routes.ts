import { manifest } from "@keel/router";
import HealthView from "./HealthView.ts";
import { loadHealth } from "./loadHealth.server.ts";

/** The `@keel/std-health` route table (std.health): `health.status` at `/health`. A deployable unions `routes.routes`. */
export const routes = manifest({
  "health.status": { path: "/health", loader: loadHealth, component: HealthView },
});
