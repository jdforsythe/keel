import { AsyncLocalStorage } from "node:async_hooks";
import type { RunScope } from "./RunScope.ts";

/** The async context of the runs (k.drive Driving), Node only. */
export const runStorage = new AsyncLocalStorage<RunScope>();
