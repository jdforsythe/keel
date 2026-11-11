import { manifest } from "@keel/router";
import { feedDigest } from "./feedDigest.server.ts";
import { loadDigest } from "./loadDigest.server.ts";
import { refresh } from "./refresh.server.ts";

/** The `digest` module: board counts that `digest.recount` keeps, on request and every hour. */
export const routes = manifest({
  "digest.show": { api: true, path: "/digest", loader: loadDigest },
  "digest.refresh": { api: true, path: "/digest/refresh" },
  "digest.feed": { api: true, path: "/digest/feed", loader: feedDigest },
});
routes.actions({ "digest.refresh": { POST: refresh } });
