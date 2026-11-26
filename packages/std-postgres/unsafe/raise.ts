import { unsafe } from "./unsafe.ts";

/**
 * Throws `e`: an error std.postgres specifies as a throw (E2453 to E2457, E2460, an `allow` with no reason, `one` of
 * several rows), a driver fault that is not a statement's answer, or a caught driver error passed on unchanged.
 */
export function raise(e: unknown): never {
  return unsafe(
    "std.postgres specifies E2453 to E2457 and E2460 as throws at the call that is wrong, a database error that is no statement's answer is a fault the caller cannot handle, and a caught driver error is passed on as the very value thrown so the caller's own catch decides; none is an expected failure a Result would carry",
    () => {
      throw e;
    },
  );
}
