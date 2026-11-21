import type { Owner } from "./Owner.ts";

/**
 * The owner of the unit that inserted each top-level node. A structural op at the top level of a unit
 * renders its own units before its anchor after the unit's nodes were recorded; those nodes belong to
 * an owner below the unit's, which is how the unit finds them (`renderUnit` nodes).
 */
export const unitOwners = new WeakMap<Node, Owner>();
