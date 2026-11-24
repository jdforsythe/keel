import { runStorage } from "./runStorage.ts";

/** Call `fn` outside every run's context (the drive's and the harness's own macrotask turns are not work). */
export const outside = <T>(fn: () => T): T => runStorage.exit(fn);
