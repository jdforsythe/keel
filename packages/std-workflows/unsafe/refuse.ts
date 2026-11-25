import { unsafe } from "./unsafe.ts";

/** Throws the error `message` names: a workflow the app declared wrongly (std.workflows E2352, E2355). */
export function refuse(message: string): never {
  return unsafe(
    "std.workflows specifies a workflow naming no state, a final state or an event its chart lacks as a throw at declaration: a bug in the app's code, never an expected failure a Result would carry",
    () => {
      throw new Error(message);
    },
  );
}
