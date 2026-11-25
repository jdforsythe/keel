import { unsafe } from "./unsafe.ts";

/** Throws the error `code` with `text`, which std.channels specifies as a throw at declaration or serve time (E2602, E1510, E1515). */
export function fault(code: string, text: string): never {
  return unsafe(
    "std.channels specifies E2602, E1510 and E1515 as throws when a channel or its route is declared: a malformed declaration is a bug in the app's code, which the process reports at startup, never an expected failure a Result would carry",
    () => {
      throw Object.assign(new Error(text), { code });
    },
  );
}
