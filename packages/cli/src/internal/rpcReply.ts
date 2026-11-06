/** A JSON-RPC 2.0 response: `result`, or `error` when `error` is given. */
export function rpcReply(
  id: string | number | null,
  result: unknown,
  error?: { readonly code: number; readonly message: string },
): Record<string, unknown> {
  return error === undefined ? { jsonrpc: "2.0", id, result } : { jsonrpc: "2.0", id, error };
}
