import { attempt } from "@keel/schema";
import { IntlRefused } from "./IntlRefused.schema.ts";

/** What `run()` returns, or `IntlRefused` when `Intl` throws a `RangeError` or `TypeError` there (an input it refuses). */
export function refusing<T>(run: () => T) {
  return attempt(run, (x) =>
    x instanceof RangeError
      ? IntlRefused.make({ thrown: "RangeError" })
      : x instanceof TypeError
        ? IntlRefused.make({ thrown: "TypeError" })
        : undefined,
  );
}
