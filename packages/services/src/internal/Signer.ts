/**
 * The `x-keel-user` signer a `createApp` binds beside its modules (k.user User header): the value a call to `module`'s
 * `url` with `body` carries for `user`, `undefined` for a `user` it refuses.
 */
export type Signer = (
  module: string,
  method: string,
  url: string,
  user: string,
  body: string | Uint8Array,
) => string | undefined;
