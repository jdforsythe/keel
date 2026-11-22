/**
 * Where one call goes: the URL its path joins, and how its Request is answered (`ctx.net.fetch`, or an app in process).
 * `sign` gives the `x-keel-user` value a call to a URL with a body carries for a `user`, on a ctx a `createApp` bound,
 * `undefined` for a `user` it refuses (k.user).
 */
export type Target = {
  readonly base: string;
  readonly module?: true;
  readonly sign?:
    | ((method: string, url: string, user: string, body: string | Uint8Array) => string | undefined)
    | undefined;
  /** The user a call that names none carries (k.user Testing); only with `sign`. */
  readonly user?: string | undefined;
  send(req: Request): Promise<Response>;
};
