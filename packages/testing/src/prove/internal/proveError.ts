/** A k.prove failure: an `Error` with `code` (E1715 to E1718) and `data`. */
export function proveError<D>(
  code: string,
  message: string,
  data: D,
): Error & { readonly code: string; readonly data: D; readonly see: "k.prove" } {
  return Object.assign(new Error(message), { code, data, see: "k.prove" as const });
}
