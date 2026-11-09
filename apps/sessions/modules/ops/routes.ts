import { manifest } from "@keel/router";
import { routes as sessions } from "@keel/std-sessions/routes";
import Home from "./Home.ts";

/** The `sessions` deployable's route table: the home page and the std-sessions ingest routes (`routes.routes`). */
export const routes = manifest({
  "ops.home": { path: "/", component: Home },
  ...sessions.routes,
});
