import type { Scope } from "@keel/reactive";
import type { Caller } from "./Caller.ts";

/** The caller of each live request scope (`createApp` sets it; `ownCaller` reads it up the `owner()` chain). */
export const callers = new WeakMap<Scope, Caller>();
