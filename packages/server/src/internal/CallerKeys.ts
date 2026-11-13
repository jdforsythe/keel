/**
 * The server's caller-cookie keys (k.server Server state), built once per `createApp` by `callerKeys`.
 * `id` is what loaders and actions see as `caller`: the base64url SHA-256 of a cookie value, `""` for `""`, so stored
 * tx `meta.caller` never holds a cookie that could be sent back. `seal` signs a fresh token as `token.mac` (HMAC-SHA-256
 * under the app's secret); `valid` holds only for such a value, so a cookie the server did not issue is no caller.
 */
export type CallerKeys = {
  readonly id: (value: string) => string;
  readonly seal: (token: string) => string;
  readonly valid: (value: string) => boolean;
};
