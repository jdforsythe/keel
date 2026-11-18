// The routes module of the HealthView suite (not a test file): the package's routes as a default export,
// which `resumeDocument` imports with `routes: () => import(...)` to evaluate them anew.
import { routes } from "@keel/std-health/routes";

export default routes;
