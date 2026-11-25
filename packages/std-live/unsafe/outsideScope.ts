import { unsafe } from "./unsafe.ts";

/** Throws E1203 for a `live()` call made outside any scope (std.live). */
export function outsideScope(): never {
  return unsafe(
    "std.live specifies E1203 as a throw when live is called outside a scope: it is a bug in the app's code, caught at the first render or setup, never an expected failure a Result would carry",
    () => {
      throw new Error("E1203: live() called outside any scope; wrap it in scope(fn)");
    },
  );
}
