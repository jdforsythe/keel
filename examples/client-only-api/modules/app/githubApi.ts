import { service } from "@keel/services";
import { GitHubApi } from "./GitHubApi.schema.ts";

/** GitHub's API, called from the browser; `topology.ts` declares its origin under `connect`. */
export const githubApi = service({ base: "https://api.github.com", schema: GitHubApi });
