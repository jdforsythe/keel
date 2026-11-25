import { unsafe } from "./unsafe.ts";

/** Throws for a `messages()` declaration std.messages refuses: locales not an `s.enum`, a bad key or a bad param. */
export function badSet(message: string): never {
  return unsafe(
    "std.messages specifies a throw for a message set declared with locales not an s.enum, a key or param name no identifier, or a param of no kind: the declaration is the app's own code in a schema file, so the fault is a bug there and never an expected failure a Result would carry",
    () => {
      throw new Error(message);
    },
  );
}
