/** A k.model failure: an `Error` with `code` (E1708, E1709 or E1710), `data` and `see`. */
export function modelError<D>(
  code: string,
  message: string,
  data: D,
): Error & { readonly code: string; readonly data: D; readonly see: "k.model" } {
  return Object.assign(new Error(message), { code, data, see: "k.model" as const });
}
