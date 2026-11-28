/**
 * Where one call goes: the URL its path joins, and how its Request is answered (`ctx.net.fetch`, or an app in process).
 * `sign` gives the `x-keel-user` value a call to a URL with a body carries for a `user`, on a ctx a `createApp` bound,
 * `undefined` for a `user` it refuses (k.user).
 */
export type Target = {
  readonly base: string;
  readonly module?: true;
  /** A Keel origin (k.services Encoding): its requests carry `x-keel: 1`; a third party's carry no Keel header. */
  readonly keel: boolean;
  readonly sign?:
    | ((method: string, url: string, user: string, body: string | Uint8Array) => string | undefined)
    | undefined;
  /** Sent from a server, on a ctx a `createApp` bound: its requests carry `x-keel-forwarded: 1` (k.topology Calls and peers). */
  readonly server?: true;
  /** The user a call that names none carries (k.user Testing); only with `sign`. */
  readonly user?: string | undefined;
  send(req: Request): Promise<Response>;
};
