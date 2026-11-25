import { unsafe } from "./unsafe.ts";

/** Throws E2801 for the widget `id`'s `key`, which `problem` says is wrong (std.headless Ids). */
export function keyFault(id: string, key: string, problem: string): never {
  return unsafe(
    "std.headless specifies E2801 as a throw at render: a malformed or repeated key is a bug in the app's code, which the nearest Boundary catches and reports, never an expected failure a Result would carry",
    () => {
      throw Object.assign(new Error(`E2801 ${id}: key ${JSON.stringify(key)} ${problem}`), { code: "E2801" });
    },
  );
}
