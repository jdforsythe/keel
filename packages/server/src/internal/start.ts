import { existsSync } from "node:fs";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { peerKey } from "@keel/compiler/hosting/peerKey";
import { createCtx } from "@keel/ctx";
import { type RouteDef, manifest } from "@keel/router";
import { createApp } from "@keel/server";
import type { StartOptions } from "../types/StartOptions.ts";
import { DeployEnv } from "./DeployEnv.ts";
import { diagLine } from "./diagLine.ts";

const line = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

/**
 * Serve one `node` deployable in production (`@keel/server/internal/start`, k.topology Build; only the generated entry calls
 * it). Parses `process.env` with `DeployEnv`: a failure prints one E1560 naming the key, never its value, and exits 1.
 * Then serves `createApp` (production, real `ctx`, the merged routes, runners, peers by `KEEL_PEER_<NAME>`, `origin`
 * from `KEEL_ORIGIN`, `allow` from `KEEL_ALLOW_ORIGINS`) on `PORT`, its storage the driver `open` opened on
 * `KEEL_DATABASE_URL` when given (k.deploy Storage; a std.db E2152 or E2153 prints that diag and exits 1), and on
 * SIGTERM or SIGINT stops listening, awaits `close()`, then the driver's `close()`, and exits 0, or 1 when either rejects (nothing is printed);
 * a second signal during shutdown does nothing.
 */
export async function start(o: StartOptions): Promise<void> {
  const peers = Object.keys(o.topology).filter((n) => n !== o.deployable && o.topology[n]?.adapter === "node");
  const storage = o.topology[o.deployable]?.storage ?? "file";
  const keys = ["PORT", "KEEL_ORIGIN", "KEEL_SECRET", "KEEL_ALLOW_ORIGINS", "KEEL_DATABASE_URL", ...peers.map(peerKey)];
  const given: Record<string, string> = {};
  for (const k of keys) {
    const v = process.env[k];
    if (v !== undefined) given[k] = v;
  }
  const json = process.env.KEEL_FORMAT === "json";
  const format = json ? "json" : "compact";
  const env = DeployEnv(peers, storage).decodeStrings(given);
  if (!env.ok) {
    const key = String(env.error.data.issues[0]?.path[0] ?? "environment");
    line(
      diagLine(format, {
        code: "E1560",
        message: `${key} fails DeployEnv (${env.error.data.issues[0]?.rule ?? "invalid"}); set it where the image runs`,
      }),
    );
    process.exit(1);
  }
  // The URL is a secret (k.deploy Storage): parsed only after DeployEnv accepted it, and never printed.
  const url = env.value.KEEL_DATABASE_URL;
  const opened = await (o.open === undefined
    ? undefined
    : o.open(new URL(typeof url === "string" ? url : "file:/data/keel.sqlite")).catch((e: unknown) => {
        const code = typeof e === "object" && e !== null && "code" in e ? e.code : undefined;
        if (code !== "E2152" && code !== "E2153") throw e;
        const text = e instanceof Error ? e.message.replace(/^E215[23] /, "") : String(code);
        line(diagLine(format, { code, message: text }));
        process.exit(1);
      }));
  const std = join(o.dir, "std.json");
  const routes: Record<string, RouteDef> = {};
  for (const m of o.routes) Object.assign(routes, m.routes);
  const app = await createApp({
    topology: o.topology,
    deployable: o.deployable,
    routes: manifest(routes),
    ctx: createCtx({ mode: "real", ...(opened === undefined ? {} : { drivers: { storage: opened } }) }),
    runners: o.runners,
    peers: Object.fromEntries(peers.map((p) => [p, String(env.value[peerKey(p)])])),
    secret: env.value.KEEL_SECRET,
    assets: o.dir,
    artifacts: o.dir,
    log: { format: json ? "json" : "compact", write: line },
    ...(existsSync(std) ? { std } : {}),
    ...(env.value.KEEL_ORIGIN === undefined ? {} : { origin: env.value.KEEL_ORIGIN }),
    ...(env.value.KEEL_ALLOW_ORIGINS === undefined
      ? {}
      : {
          allow: env.value.KEEL_ALLOW_ORIGINS.split(",").map((o) => o.trim()),
        }),
  });
  const port = env.value.PORT ?? 8080;
  const server = serve({ fetch: app.fetch, port }, (a) => {
    line(json ? JSON.stringify({ kind: "summary", name: "listen", port: a.port }) : `ok listening on port ${a.port}`);
  });
  // Only an error before the server listens is the bind failure.
  server.on("error", (e) => {
    if (server.listening) return;
    line(
      diagLine(format, {
        code: "E1560",
        message: `PORT ${port} fails to bind (${"code" in e ? e.code : "error"}); free it or set another PORT`,
      }),
    );
    process.exit(1);
  });
  let stopping = false;
  const closed = (f: () => Promise<unknown> | undefined): Promise<boolean> =>
    Promise.resolve()
      .then(f)
      .then(
        () => true,
        () => false,
      );
  const stop = (): void => {
    if (stopping) return;
    stopping = true;
    server.close();
    void (async () => {
      const app_ = await closed(() => app.close());
      const store = await closed(() => opened?.close?.());
      process.exit(app_ && store ? 0 : 1);
    })();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
