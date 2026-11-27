/**
 * The connection a request came over, as `@hono/node-server` hands it to `fetch` (its `incoming` request): `start`
 * and `keel dev` pass it; a request `fetch` gets without one (a harness, an in-process peer) has no remote address
 * (k.contract Local routes).
 */
export type Connection = {
  readonly incoming: { readonly socket: { readonly remoteAddress?: string | undefined } };
};
