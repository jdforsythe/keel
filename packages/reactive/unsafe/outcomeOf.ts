import type { Outcome } from "../src/internal/Outcome.ts";
import { isKeelResult } from "../src/internal/isKeelResult.ts";
import { unsafe } from "./unsafe.ts";

/** What a fetcher gave as an `Outcome`: a k.schema `Result` as it is, any other value as the `ok` of it. */
export function outcomeOf<V>(v: V | Outcome<V>): Outcome<V> {
  return unsafe(
    "only k.schema ok and err set the Symbol.for keel.result brand, on every Result they make (resultBrand), so a branded value is an Outcome and any other is the fetcher's V",
    () => (isKeelResult(v) ? (v as Outcome<V>) : { ok: true, value: v as V }),
  );
}
