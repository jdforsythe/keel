import { contract } from "@keel/router/contract";

/** The `@keel/std-health` contract (std.health, the `./contract` export): the page `health.status` at `/health`. */
export const health = contract("health", { "health.status": { path: "/health" } });
