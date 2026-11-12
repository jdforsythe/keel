import type { Worker } from "node:worker_threads";

/** Every group user worker started and not yet exited (std.multi); a group's `stop`, and any throw, leave none. */
export const running = new Set<Worker>();
