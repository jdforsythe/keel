import { AsyncLocalStorage } from "node:async_hooks";

/** Set while a request `createApp` serves runs, through every `await` in it (k.resume Stores); unset in runners (`keepRunning`) and at startup (`createApp`), even when they start inside a request. */
export const serving = new AsyncLocalStorage<boolean>();
