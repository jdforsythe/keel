import { manifest } from "@keel/router";
import { digest } from "./digest.contract.ts";
import { feedDigest } from "./feedDigest.server.ts";
import { loadDigest } from "./loadDigest.server.ts";
import { refresh } from "./refresh.server.ts";

/** The `digest` module: board counts that `digest.recount` keeps, on request and every hour. */
export const routes = manifest(digest, {
  "digest.show": { loader: loadDigest },
  "digest.refresh": { action: refresh },
  "digest.feed": { loader: feedDigest },
});
