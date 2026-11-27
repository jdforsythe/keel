import { existsSync } from "node:fs";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { peerKey } from "@keel/compiler/hosting/peerKey";
import { createCtx } from "@keel/ctx";
import { isRefusal } from "@keel/schema/internal/refusal";
import { createApp } from "@keel/server";
import { onUncaught } from "@keel/server/internal/onUncaught";
import type { StartOptions } from "../types/StartOptions.ts";
import { DeployEnv } from "./DeployEnv.ts";
import { diagLine } from "./diagLine.ts";
import { logThrownOpen } from "./logThrownOpen.ts";
import { logThrownUntil } from "./logThrownUntil.ts";
import { refusedLine } from "./refusedLine.ts";

const line = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

/**
 * Serve one `node` deployable in production (`@keel/server/internal/start`, k.topology Build; only the generated entry calls
 * it). A `'sqlite'` deployable on a Node older than 22.13 (`node`, the running version by default) prints one E1560 naming
 * both versions and exits 1 before the driver loads. Parses `process.env` with `DeployEnv`: a failure prints one E1560 naming the key, never its value, and exits 1.
 * Then serves `createApp` (production, real `ctx`, its route table, runners, the identity source, peers by `KEEL_PEER_<NAME>`, `origin`
 * from `KEEL_ORIGIN`, `allow` from `KEEL_ALLOW_ORIGINS`) on `PORT`, its storage the driver `open` opened on
 * `KEEL_DATABASE_URL` when given (k.deploy Storage; a std.db E2152 or E2153 prints that diag and exits 1), and on
 * SIGTERM or SIGINT stops listening, awaits `close()`, then the driver's `close()`, and exits 0, or 1 when either rejects (nothing is printed);
 * a second signal during shutdown does nothing. A coded refusal before it listens (E1596, E1552, E1555, E1560, E1765)
 * prints one `diag` with its own code, message and `see` and exits 1, with no E1577 (k.deploy Refusals at start). Every `uncaughtException` and `unhandledRejection` prints one E1577
 * `diag`, with the scrubbed thrown text only inside the `KEEL_LOG_THROWN` window (`onUncaught`, k.leave Process); the first then stops listening, lets requests in
 * flight finish for at most 10,000 ms, awaits `close()` and the driver's `close()`, and exits 1; a later one prints its
 * record only.
 */
export async function start(o: StartOptions, node = process.versions.node): Promise<void> {
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
  // Set as startup reaches them, so a fault at any point drains what exists.
  const live: {
    server?: ReturnType<typeof serve>;
    app?: Awaited<ReturnType<typeof createApp>>;
    opened?: Awaited<ReturnType<NonNullable<StartOptions["open"]>>>;
  } = {};
  let stopping = false;
  let busy = 0;
  let idle = (): void => undefined;
  const closed = (f: () => Promise<unknown> | undefined): Promise<boolean> =>
    Promise.resolve()
      .then(f)
      .then(
        () => true,
        () => false,
      );
  const stop = (fault: boolean): void => {
    if (stopping) return;
    stopping = true;
    live.server?.close();
    void (async () => {
      if (fault)
        await new Promise<void>((done) => {
          idle = done;
          if (busy === 0) done();
          setTimeout(done, 10_000);
        });
      const a = await closed(() => live.app?.close());
      const st = await closed(() => live.opened?.close?.());
      process.exit(fault || !a || !st ? 1 : 0);
    })();
  };
  // The text window of an uncaught throw's record (k.serverlog): before the start is read, the throw's own reading
  // stands for it (`logThrownOpen`); after, the throw reads before the instant.
  let clock: { now(): number } = createCtx({ mode: "real" }).clock;
  let until: number | undefined;
  let read = false;
  onUncaught(
    { format, write: line },
    o.dir,
    () => (read ? until !== undefined && clock.now() < until : logThrownOpen(process.env.KEEL_LOG_THROWN, clock.now())),
    () => stop(true),
  );
  try {
    await serveIt();
  } catch (e) {
    // A coded refusal before the server listens is Keel's own text (k.deploy Refusals at start).
    if (!isRefusal(e) || live.server?.listening === true) throw e;
    line(refusedLine(format, e));
    process.exit(1);
  }
  async function serveIt(): Promise<void> {
    const fail = (message: string, code = "E1560"): never => {
      line(diagLine(format, { code, message }));
      return process.exit(1);
    };
    const [major = 0, minor = 0] = node.split(".").map(Number);
    if (storage === "sqlite" && major * 1e3 + minor < 22013)
      return fail(`storage 'sqlite' needs Node 22.13 or newer; this is ${node}`);
    const env = DeployEnv(peers, storage).decodeStrings(given);
    if (!env.ok) {
      const key = String(env.error.data.issues[0]?.path[0] ?? "environment");
      return fail(
        `${key} fails DeployEnv (${env.error.data.issues[0]?.rule ?? "invalid"}); set it where the image runs`,
      );
    }
    // The URL is a secret (k.deploy Storage): parsed only after DeployEnv accepted it, and never printed.
    const url = env.value.KEEL_DATABASE_URL;
    const opened = await (o.open === undefined
      ? undefined
      : o.open(new URL(typeof url === "string" ? url : "file:/data/keel.sqlite")).catch((e: unknown) => {
          const code: unknown = Reflect.get(Object(e), "code");
          if (code !== "E2152" && code !== "E2153") throw e;
          return fail(e instanceof Error ? e.message.replace(/^E215[23] /, "") : String(code), code);
        }));
    if (opened !== undefined) live.opened = opened;
    const std = join(o.dir, "std.json");
    const ctx = createCtx({ mode: "real", ...(opened === undefined ? {} : { drivers: { storage: opened } }) });
    until = logThrownUntil(process.env.KEEL_LOG_THROWN, ctx.clock.now());
    clock = ctx.clock;
    read = true;
    const app = await createApp({
      topology: o.topology,
      origins: o.origins ?? {},
      deployable: o.deployable,
      routes: o.routes,
      ctx,
      runners: o.runners,
      identity: o.identity,
      peers: Object.fromEntries(peers.map((p) => [p, String(env.value[peerKey(p)])])),
      secret: env.value.KEEL_SECRET,
      assets: o.dir,
      artifacts: o.dir,
      log: { format, write: line },
      ...(existsSync(std) ? { std } : {}),
      ...(env.value.KEEL_ORIGIN === undefined ? {} : { origin: env.value.KEEL_ORIGIN }),
      ...(env.value.KEEL_ALLOW_ORIGINS === undefined
        ? {}
        : {
            allow: env.value.KEEL_ALLOW_ORIGINS.split(",").map((o) => o.trim()),
          }),
    });
    live.app = app;
    const port = env.value.PORT ?? 8080;
    const srv = serve({ fetch: app.fetch, port }, (a) => {
      line(json ? JSON.stringify({ kind: "summary", name: "listen", port: a.port }) : `ok listening on port ${a.port}`);
    });
    live.server = srv;
    srv.on("request", (_q, res) => {
      busy++;
      res.on("close", () => {
        if (--busy === 0) idle();
      });
    });
    // Only an error before the server listens is the bind failure. A start refusal echoes no environment value
    // (k.deploy Refusals at start), so a set PORT is named by its key; the default is Keel's own number.
    srv.on("error", (e) => {
      if (srv.listening) return;
      const why = "code" in e ? e.code : "error";
      fail(
        env.value.PORT === undefined
          ? `port 8080 fails to bind (${why}); free it or set PORT`
          : `PORT fails to bind (${why}); free the port it names or set another`,
      );
    });
    process.on("SIGTERM", () => stop(false));
    process.on("SIGINT", () => stop(false));
  }
}
