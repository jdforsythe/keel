/**
 * The server's keys (k.server Server state, k.user Across deployables and User header), built once per `createApp` by
 * `callerSigner`. `id` is what loaders and actions see as `caller`: the base64url SHA-256 of a cookie value, `""` for
 * `""`, so stored tx `meta.caller` never holds a cookie that could be sent back. `seal` signs a fresh token as
 * `token.mac` (HMAC-SHA-256 under the app's secret); `valid` holds only for such a value, so a cookie the server did not
 * issue is no caller. `assert` is the `x-keel-user` value a module call to `url` on deployable `to` with `body` carries
 * for `user`, valid until 60 s after `now`; `undefined` for a `user` over 256 characters. `user` is the user a request's
 * `x-keel-user` asserts when this secret signed it for its method, path, search, `body` and this deployable, its expiry
 * has not passed at `now` and is at most 65 s ahead of it, and its `user` is at most 256 characters; else `undefined`.
 */
export type CallerKeys = {
  readonly id: (value: string) => string;
  readonly seal: (token: string) => string;
  readonly valid: (value: string) => boolean;
  readonly assert: (
    method: string,
    url: string,
    user: string,
    to: string,
    body: string | Uint8Array,
    now: number,
  ) => string | undefined;
  readonly user: (raw: Request, now: number, body: Uint8Array) => string | undefined;
};
