import { AsyncLocalStorage } from "node:async_hooks";

/** Set while a request `createApp` serves runs, through every `await` in it (k.resume Stores); unset in runners and at startup. */
export const serving = new AsyncLocalStorage<boolean>();
