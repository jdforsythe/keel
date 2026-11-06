/** One received JSON-RPC 2.0 message, classified (only requests and notifications are served). */
export type RpcMessage =
  | { readonly kind: "request"; readonly id: string | number | null; readonly method: string; readonly params: unknown }
  | { readonly kind: "notification"; readonly method: string; readonly params: unknown }
  | { readonly kind: "invalid"; readonly id: string | number | null; readonly message: string }
  | { readonly kind: "unparsable" };
