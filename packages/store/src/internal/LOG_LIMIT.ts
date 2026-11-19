/**
 * The default `logLimit` (k.store Log limit): the most log entries a store keeps, and so a snapshot holds.
 * 256 covers any interactive undo depth and bounds what a server request restores (validate and bind at most 256
 * entries per store) and what `ctx.storage` holds per store, whatever the traffic.
 */
export const LOG_LIMIT = 256;
