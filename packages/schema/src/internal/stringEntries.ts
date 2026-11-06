/** Normalise FormData, URLSearchParams or a plain record into key -> values. Non-string (File) entries and empty lists are dropped. */
export function stringEntries(
  input: FormData | URLSearchParams | Record<string, string | string[]>,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (k: string, v: string): void => {
    out.set(k, [...(out.get(k) ?? []), v]);
  };
  if (input instanceof FormData || input instanceof URLSearchParams) {
    for (const [k, v] of input.entries()) if (typeof v === "string") add(k, v);
  } else {
    for (const [k, v] of Object.entries(input)) for (const item of typeof v === "string" ? [v] : v) add(k, item);
  }
  return out;
}
