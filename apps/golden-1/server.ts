// API deployable of golden-1 (topology `api`, adapter `node`): `pnpm --filter golden-1 api`, port 4181 (env
// `KEEL_API_PORT` overrides). It owns the board (`api.board`, process-shared); the `web` client reads and writes it
// over HTTP. Node 24 runs this file with type stripping; vite proxies `/api` here in dev and preview.
import { serve } from "@hono/node-server";
import { createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { board } from "./modules/api/board.ts";
import { routes } from "./modules/api/routes.ts";
import topology from "./topology.ts";

const PORT = Number(process.env.KEEL_API_PORT ?? 4181);
const DEPLOYABLE = "api";
const log = { format: "compact", write: (line: string) => process.stdout.write(`${line}\n`) } as const;

const app = await createApp({
  topology,
  routes,
  ctx: createCtx({ mode: "real" }),
  deployable: DEPLOYABLE,
  expose: [board],
  log,
});
serve({ fetch: app.fetch, port: PORT }, (info) => log.write(`ok ${DEPLOYABLE} listening on :${info.port}`));
