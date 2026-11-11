import { existsSync } from "node:fs";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { createCtx } from "@keel/ctx";
import { type RouteDef, manifest } from "@keel/router";
import { createApp } from "@keel/server";
import { DeployEnv } from "./internal/DeployEnv.ts";
import type { StartOptions } from "./types/StartOptions.ts";

const line = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

/**
 * Serve one `node` deployable in production (`@keel/server/start`, k.topology Build; only the generated entry calls
 * it). Parses `process.env` with `DeployEnv`: a failure prints one E1560 naming the key, never its value, and exits 1.
 * Then serves `createApp` (production, real `ctx`, the merged routes, runners, peers by `KEEL_PEER_<NAME>`, `origin`
 * from `KEEL_ORIGIN`, `allow` from `KEEL_ALLOW_ORIGINS`) on `PORT`, and on SIGTERM or SIGINT stops listening, awaits `close()` and exits 0.
 */
export async function start(o: StartOptions): Promise<void> {
  const peers = Object.keys(o.topology).filter((n) => n !== o.deployable && o.topology[n]?.adapter === "node");
  const keys = [
    "PORT",
    "KEEL_ORIGIN",
    "KEEL_SECRET",
    "KEEL_ALLOW_ORIGINS",
    ...peers.map((p) => `KEEL_PEER_${p.toUpperCase()}`),
  ];
  const given: Record<string, string> = {};
  for (const k of keys) {
    const v = process.env[k];
    if (v !== undefined) given[k] = v;
  }
  const env = DeployEnv(peers).decodeStrings(given);
  if (!env.ok) {
    const key = String(env.error.data.issues[0]?.path[0] ?? "environment");
    line(`E1560 ${key} fails DeployEnv (${env.error.data.issues[0]?.rule ?? "invalid"}); set it where the image runs`);
    process.exit(1);
  }
  const std = join(o.dir, "std.json");
  const routes: Record<string, RouteDef> = {};
  for (const m of o.routes) Object.assign(routes, m.routes);
  const app = await createApp({
    topology: o.topology,
    deployable: o.deployable,
    routes: manifest(routes),
    ctx: createCtx({ mode: "real" }),
    runners: o.runners,
    peers: Object.fromEntries(peers.map((p) => [p, String(env.value[`KEEL_PEER_${p.toUpperCase()}`])])),
    secret: env.value.KEEL_SECRET,
    assets: o.dir,
    artifacts: o.dir,
    log: { format: process.env.KEEL_FORMAT === "json" ? "json" : "compact", write: line },
    ...(existsSync(std) ? { std } : {}),
    ...(env.value.KEEL_ORIGIN === undefined ? {} : { origin: env.value.KEEL_ORIGIN }),
    ...(env.value.KEEL_ALLOW_ORIGINS === undefined
      ? {}
      : { allow: env.value.KEEL_ALLOW_ORIGINS.split(",").map((o) => o.trim()) }),
  });
  const server = serve({ fetch: app.fetch, port: env.value.PORT ?? 8080 });
  const stop = (): void => {
    server.close();
    void app.close().then(() => process.exit(0));
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
