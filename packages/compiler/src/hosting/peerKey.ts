/**
 * The environment key that carries deployable `name`'s origin to its peers (k.topology Build): `KEEL_PEER_` and the
 * name upper-cased with `-` as `_` (`my-api` -> `KEEL_PEER_MY_API`). Names have the form `[a-z][a-z0-9-]*`
 * (`deployableNameProblem`), which has no `_`, so the mapping is injective: two valid names give one key only if they
 * are the same name.
 */
export function peerKey(name: string): string {
  return `KEEL_PEER_${name.toUpperCase().replaceAll("-", "_")}`;
}
