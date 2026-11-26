import { unsafe } from "./unsafe.ts";

/** Throws the `RangeError` std.i18n specifies for an input `fn` refuses: its message `<fn>: <why>`. */
export function refuse(fn: string, why: string): never {
  return unsafe(
    "std.i18n specifies a throw for an input its formatters refuse, as std.temporal's durationOf does: the input comes from the app's own code, so a bad one is a bug there and never an expected failure a Result would carry",
    () => {
      throw new RangeError(`${fn}: ${why}`);
    },
  );
}
