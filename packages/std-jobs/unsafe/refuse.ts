import { unsafe } from "./unsafe.ts";

/** Throws the error `message` names: a job or a queue the app declared or used wrongly, or a stored queue that is not one (std.jobs). */
export function refuse(message: string): never {
  return unsafe(
    "std.jobs specifies job and queue as throwing E2503 and E2505 at declaration, and an unknown job id or a stored value that is not a queue is a bug in the app's code or a corrupted store, never an expected failure a Result would carry",
    () => {
      throw new Error(message);
    },
  );
}
