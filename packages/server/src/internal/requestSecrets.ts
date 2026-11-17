import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The revealed secrets of the request, or the runner's `run` (`keepRunning`), whose code is running (k.privacy Server
 * log); none at startup or outside both.
 */
export const requestSecrets = new AsyncLocalStorage<Set<string>>();
