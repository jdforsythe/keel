/**
 * A channel's membership predicate (std.channels Serve): pure and synchronous over the request's `caller` and `user`
 * (k.user; a stream's re-check after a save sees the `user` it opened with), the parsed `params` and the channel's
 * `stores` opened read-only. A throw counts as false.
 */
export type Member<P, S> = (at: {
  readonly caller: string;
  readonly user: string;
  readonly params: P;
  readonly stores: S;
}) => boolean;
