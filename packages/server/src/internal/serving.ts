import { AsyncLocalStorage } from "node:async_hooks";
import type { RequestScope } from "./RequestScope.ts";

/**
 * The request `createApp` serves: its route id (`-` when no route matched) and the values its records never hold,
 * through every `await`, timer and promise it schedules, for their whole life (k.leave Module stores); unset in runners
 * (`keepRunning`) and at startup (`createApp`), even when they start inside a request.
 */
export const serving = new AsyncLocalStorage<
  (Pick<RequestScope, "pii" | "secrets"> & { readonly route: string }) | undefined
>();
