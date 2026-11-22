import { s } from "@keel/schema";

/** The fields this app reads from GitHub's list of a repository's releases; the API sends more, and they are ignored. */
export const Releases = s.array(
  s.object({ tag_name: s.string(), name: s.string().nullable(), published_at: s.string().nullable() }),
);
