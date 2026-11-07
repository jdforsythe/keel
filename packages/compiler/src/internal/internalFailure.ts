/**
 * E1049 (k.compiler): a failure inside the compiler, never attributed to app code. An `Error` with `code: "E1049"`,
 * no app location, and the underlying message verbatim after `internal compiler failure: `.
 */
export function internalFailure(cause: unknown): Error & { readonly code: string } {
  const message = cause instanceof Error ? cause.message : String(cause);
  return Object.assign(new Error(`internal compiler failure: ${message}`, { cause }), { code: "E1049" });
}
