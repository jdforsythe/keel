import { unsafe } from "./unsafe.ts";

/** Throws the `RangeError` std.text specifies for a bound of `line`, `para` or `truncate` that is out of range; `message` says which. */
export function boundFault(message: string): never {
  return unsafe(
    "std.text specifies a throw for a line, para or truncate bound that is no integer in range: bounds are written in the app's own code, so a bad one is a bug there, never an expected failure a Result would carry",
    () => {
      throw new RangeError(message);
    },
  );
}
