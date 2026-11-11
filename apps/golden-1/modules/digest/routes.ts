import { manifest } from "@keel/router";
import DigestApi from "./DigestApi.ts";
import RefreshApi from "./RefreshApi.ts";
import { feedDigest } from "./feedDigest.server.ts";
import { loadDigest } from "./loadDigest.server.ts";
import { refresh } from "./refresh.server.ts";

/** The `digest` module: board counts that `digest.recount` keeps, on request and every hour. */
export const routes = manifest({
  "digest.show": { path: "/digest", loader: loadDigest, component: DigestApi },
  "digest.refresh": { path: "/digest/refresh", component: RefreshApi },
  "digest.feed": { path: "/digest/feed", loader: feedDigest, component: DigestApi },
});
routes.actions({ "digest.refresh": { POST: refresh } });
