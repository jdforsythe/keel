import { unsafe } from "./unsafe.ts";

/** Throws an Error with `message` (and `code` when given): std.offline specifies E1203 and E2651 as throws and a value no outbox call returned, or an entry the store refuses, as misuse that throws. */
export function raise(message: string, code?: string): never {
  return unsafe(
    "std.offline specifies E1203 and E2651 as throws at the call that is wrong, and a value that is no outbox or an entry the store refuses is the same kind of misuse: each is a bug in the app's code, reported at once, never an expected failure a Result would carry",
    () => {
      throw code === undefined ? new Error(message) : Object.assign(new Error(message), { code });
    },
  );
}
