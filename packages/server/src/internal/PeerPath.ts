/**
 * A path another deployable serves (from `routes.json`): its segments (`:name` matches any one), that deployable, and
 * `local: true` when its route is a `local` one (k.contract Local routes), which is never forwarded.
 */
export type PeerPath = {
  readonly segments: readonly string[];
  readonly deployable: string;
  readonly local?: true;
};
