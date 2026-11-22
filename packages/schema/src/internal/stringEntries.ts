/**
 * A `FormData` or `URLSearchParams` of any realm, read by shape: under `keel test` the DOM's `FormData` is happy-dom's,
 * while a body a `Request` or `Response` parses is Node's (k.mount Testing). A plain record's values are never functions.
 */
function isEntries(
  input: FormData | URLSearchParams | Record<string, string | string[]>,
): input is FormData | URLSearchParams {
  return typeof Reflect.get(input, "entries") === "function" && typeof Reflect.get(input, "getAll") === "function";
}

/** Normalise FormData, URLSearchParams or a plain record into key -> values. Non-string (File) entries and empty lists are dropped. */
export function stringEntries(
  input: FormData | URLSearchParams | Record<string, string | string[]>,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (k: string, v: string): void => {
    out.set(k, [...(out.get(k) ?? []), v]);
  };
  if (isEntries(input)) {
    for (const [k, v] of input.entries()) if (typeof v === "string") add(k, v);
  } else {
    for (const [k, v] of Object.entries(input)) for (const item of typeof v === "string" ? [v] : v) add(k, item);
  }
  return out;
}
