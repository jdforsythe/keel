import { unsafe } from "./unsafe.ts";

/** Treat the matched union value as the variant a `Case` tag selects. */
export function narrow<V>(value: unknown): V {
  return unsafe(
    "Match only renders a Case when the value's discriminant equals the Case tag, so the value is that variant",
    () => value as V,
  );
}
