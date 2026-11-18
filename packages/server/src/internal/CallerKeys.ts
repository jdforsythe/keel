/**
 * The server's keys (k.server Server state, k.user Across deployables), built once per `createApp` by `callerSigner`.
 * `id` is what loaders and actions see as `caller`: the base64url SHA-256 of a cookie value, `""` for `""`, so stored
 * tx `meta.caller` never holds a cookie that could be sent back. `seal` signs a fresh token as `token.mac` (HMAC-SHA-256
 * under the app's secret); `valid` holds only for such a value, so a cookie the server did not issue is no caller.
 * `assert` is the `x-keel-user` value a module call to `url` carries for `user`, valid until 60 s after `now`; `user` is
 * the user a request's `x-keel-user` asserts when this secret signed it for its method, path and search and it has not
 * expired at `now`, else `undefined`.
 */
export type CallerKeys = {
  readonly id: (value: string) => string;
  readonly seal: (token: string) => string;
  readonly valid: (value: string) => boolean;
  readonly assert: (method: string, url: string, user: string, now: number) => string;
  readonly user: (raw: Request, now: number) => string | undefined;
};
