import type { RouteDef } from "../types/RouteDef.ts";

/**
 * Route entries a router or server has compiled for matching (`compileTable`): `routes.actions` refuses them (E1505),
 * so actions cannot change after `createRouter` or `createApp` checked the table (E1553, backlog 0183).
 */
export const sealed = new WeakSet<RouteDef>();
