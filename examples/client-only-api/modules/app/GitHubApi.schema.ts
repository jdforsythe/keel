import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import { Releases } from "./Releases.schema.ts";

/** The one GitHub endpoint this app calls: a repository's releases, newest first. */
export const GitHubApi = endpoints({
  releases: {
    method: "GET",
    path: "/repos/:owner/:repo/releases",
    params: s.object({ owner: s.string(), repo: s.string() }),
    query: s.object({ per_page: s.int({ min: 1, max: 100 }) }),
    output: Releases,
  },
});
