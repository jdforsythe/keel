/**
 * Where one call goes: the URL its path joins, and how its Request is answered (`ctx.net.fetch`, or an app in process).
 * `sign` gives the `x-keel-user` value a call to a URL carries for a `user`, on a ctx a `createApp` bound (k.user).
 */
export type Target = {
  readonly base: string;
  readonly module?: true;
  readonly sign?: ((method: string, url: string, user: string) => string) | undefined;
  send(req: Request): Promise<Response>;
};
