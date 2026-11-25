import { unsafe } from "./unsafe.ts";

/** Throws the error `message` names: a schedule the app declared wrongly (E2551, E2554), a refused first fire, a stored value that holds no marks (std.schedules). */
export function refuse(message: string): never {
  return unsafe(
    "std.schedules specifies a schedule with an unparsable cron, a foreign job or a refused input as a throw at declaration, and a refused enqueue as a rejection of run: bugs in the app's code or its storage, never expected failures a Result would carry",
    () => {
      throw new Error(message);
    },
  );
}
