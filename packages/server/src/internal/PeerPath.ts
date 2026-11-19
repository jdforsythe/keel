/** A path another deployable serves (from `routes.json`): its segments (`:name` matches any one) and that deployable. */
export type PeerPath = {
  readonly segments: readonly string[];
  readonly deployable: string;
};
