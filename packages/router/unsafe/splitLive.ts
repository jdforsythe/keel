import { unsafe } from "./unsafe.ts";

/**
 * A loader's `fn` as the live form `L` when it is an async generator function, else as the plain form `P`. The
 * overloads of `loader` type each form by its entry, and at run time only the function's kind tells them apart.
 */
export function splitLive<P, L>(fn: P | L): { readonly live: L } | { readonly plain: P } {
  const live = Reflect.get(Object(fn), Symbol.toStringTag) === "AsyncGeneratorFunction";
  return unsafe(
    "loader's overloads give an async generator function only to a live entry, so its kind tells the LiveFn form from the plain one",
    () => (live ? { live: fn as L } : { plain: fn as P }),
  );
}
