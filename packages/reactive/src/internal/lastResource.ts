/**
 * The graph node id (as `inspect()` lists it) of the resource whose `get()` ran last, 0 before any (rfc:0070):
 * `Match` resets it, evaluates its `on`, and reports the id with the rendered state. A number write, no allocation.
 */
export const lastResource: { id: number } = { id: 0 };
