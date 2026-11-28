import { unsafe } from "./unsafe.ts";

/**
 * `input` as a `FormData` or `URLSearchParams` of any realm, read by shape, else `undefined`: under `keel test` the
 * DOM's `FormData` is happy-dom's, while a body a `Request` or `Response` parses is Node's (k.mount Testing).
 */
export function formEntriesOf(
  input: FormData | URLSearchParams | Record<string, string | string[]>,
): FormData | URLSearchParams | undefined {
  if (typeof Reflect.get(input, "entries") !== "function" || typeof Reflect.get(input, "getAll") !== "function")
    return undefined;
  return unsafe(
    "a plain record input holds only strings or string arrays, never functions, so one whose entries and getAll are functions is a FormData or URLSearchParams",
    () => input as FormData | URLSearchParams,
  );
}
