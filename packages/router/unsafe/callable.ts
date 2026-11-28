import { unsafe } from "./unsafe.ts";

/**
 * `v` as the function type `F` when it is a function, else `undefined`. A binding's `component`, `errorElement` and
 * `title` are typed by `manifest`'s signature (`Binding`); at run time only that each is callable is known.
 */
export function callable<F extends (...args: never[]) => unknown>(v: unknown): F | undefined {
  if (typeof v !== "function") return undefined;
  return unsafe(
    "manifest's Binding signature types component, errorElement and title, so a bound function has the type F that bindTable reads it as",
    () => v as F,
  );
}
