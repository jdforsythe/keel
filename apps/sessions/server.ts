// Keel's own session ingest service (topology `sessions`, adapter `node`): `pnpm --filter sessions start`, port 4200
// (env `KEEL_SESSIONS_PORT` overrides). It serves `@keel/std-sessions/routes`: `POST /sessions` files a recorded
// session in store `sessions.archive` (backed by Node's localStorage in `.sessions.storage`), and `GET /sessions/list`
// answers the callers whose hashes `modules/ops/module.ts` lists in `readers`. `KEEL_SESSIONS_SECRET` (32+ bytes) signs
// caller cookies, so a reader hash survives restarts. This entry is the only place that reads `process.env`.
import { serve } from "@hono/node-server";
import { createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { routes } from "./modules/ops/routes.ts";
import topology from "./topology.ts";

const PORT = Number(process.env.KEEL_SESSIONS_PORT ?? 4200);
const DEPLOYABLE = "sessions";
const MODE = process.env.NODE_ENV === "development" ? "dev" : "production";
const SECRET = process.env.KEEL_SESSIONS_SECRET;
const log = { format: "compact", write: (line: string) => process.stdout.write(`${line}\n`) } as const;

const app = await createApp({
  topology,
  routes,
  ctx: createCtx({ mode: "real" }),
  deployable: DEPLOYABLE,
  mode: MODE,
  assets: `${import.meta.dirname}/dist/${DEPLOYABLE}`,
  std: `${import.meta.dirname}/.keel/std.json`,
  ...(SECRET === undefined ? {} : { secret: SECRET }),
  log,
});
serve({ fetch: app.fetch, port: PORT }, (info) => log.write(`ok ${DEPLOYABLE} listening on :${info.port}`));
