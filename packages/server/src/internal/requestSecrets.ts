import { AsyncLocalStorage } from "node:async_hooks";

/** The revealed secrets of the request whose code is running (k.privacy Server log); none outside a request. */
export const requestSecrets = new AsyncLocalStorage<Set<string>>();
