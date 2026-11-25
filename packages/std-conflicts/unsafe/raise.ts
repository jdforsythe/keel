import { unsafe } from "./unsafe.ts";

/** Throws an Error with `message`: a stores factory that does not match the snapshot is a misuse by the caller, which throws. */
export function raise(message: string): never {
  return unsafe(
    "a stores factory that holds no store of the snapshot, lacks a logged transaction or makes nothing is a misuse by the code that calls races: it is a bug in the code that calls it, reported at once, never an expected failure a Result would carry",
    () => {
      throw new Error(message);
    },
  );
}
