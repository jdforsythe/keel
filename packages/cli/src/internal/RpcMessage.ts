/** A JSON-RPC 2.0 message as received (request when `id` is present, else notification). */
export type RpcMessage = {
  readonly id: string | number | null | undefined;
  readonly method: string | undefined;
  readonly params: unknown;
};
