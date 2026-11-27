import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Store } from "@keel/store";
import type { AnswerEntry } from "../internal/e2e/AnswerEntry.ts";
import type { ContextRun } from "../internal/e2e/ContextRun.ts";
import type { Deployable } from "../internal/e2e/Deployable.ts";
import type { Proc } from "../internal/e2e/Proc.ts";
import type { ProxyServer } from "../internal/e2e/ProxyServer.ts";
import type { StaticHost } from "../internal/e2e/StaticHost.ts";
import type { StoreReader } from "../internal/e2e/StoreReader.ts";
import type { StoreSource } from "../internal/e2e/StoreSource.ts";
import { answerEntries } from "../internal/e2e/answerEntries.ts";
import { boundMs } from "../internal/e2e/boundMs.ts";
import { compactRecord } from "../internal/e2e/compactRecord.ts";
import { devProc } from "../internal/e2e/devProc.ts";
import { e2eError } from "../internal/e2e/e2eError.ts";
import { freePort } from "../internal/e2e/freePort.ts";
import { hostStatic } from "../internal/e2e/hostStatic.ts";
import { libraryPage } from "../internal/e2e/libraryPage.ts";
import { openContext } from "../internal/e2e/openContext.ts";
import { openStore } from "../internal/e2e/openStore.ts";
import { readProject } from "../internal/e2e/readProject.ts";
import { requireE2e } from "../internal/e2e/requireE2e.ts";
import { serverEnv } from "../internal/e2e/serverEnv.ts";
import { spawnProc } from "../internal/e2e/spawnProc.ts";
import { startProxy } from "../internal/e2e/startProxy.ts";
import { testEnd } from "../internal/e2e/testEnd.ts";
import type { LogRecord } from "../types/LogRecord.ts";
import type { ServeOptions } from "../types/ServeOptions.ts";
import type { Served } from "../types/Served.ts";
import type { StoreLog } from "../types/StoreLog.ts";
import { build } from "./build.ts";

/** Readiness bound (k.e2e serve): 20 s of the machine's own work, fixed time. */
const READY = 20_000;
/** Every 100 ms when the storage reports no commits (k.e2e Served `until`). */
const POLL = 100;
const LAST = 10;

/** The variables `serve` sets itself, which a deploy's `compose.yaml` also requires. */
const OWN = new Set(["PORT", "KEEL_SECRET", "KEEL_ORIGIN", "KEEL_FORMAT", "KEEL_ALLOW_ORIGINS"]);

const startFailure = (name: string, cause: string, records: readonly LogRecord[]): Error =>
  e2eError("E1737", `${name} did not start: ${cause}`, { deployable: name, records: records.slice(-LAST) });

const originOf = (o: string): string => {
  try {
    return new URL(o).origin;
  } catch {
    return o;
  }
};

/**
 * Starts the built deployables of a project (k.e2e serve): each `node` one from `dist/<name>/server.mjs` on a free port
 * with a fresh data folder, one random `KEEL_SECRET`, its peers and allowed origins wired and `KEEL_FORMAT=json`, `env`
 * last; each `static` and unserved `client` one on a static host of the run with `csp.txt` as its policy header. It
 * resolves once every deployable answers; a deployable that cannot start is E1737, with everything already started
 * stopped. The handle is disposed when the test ends.
 */
export async function serve(options: ServeOptions = {}): Promise<Served> {
  requireE2e("serve");
  const dir = resolve(options.project ?? process.cwd());
  if (options.page !== undefined) {
    // A library's page: its host project written, built and served as an app is (k.e2e Libraries).
    const host = libraryPage(dir, options);
    const removeHost = async (): Promise<void> => rmSync(host, { recursive: true, force: true });
    try {
      await build(host);
      const { page: _page, props: _props, wrap: _wrap, tokens: _tokens, ...rest } = options;
      const inner = await serve({ ...rest, project: host });
      // The host folder is the handle's: removed at dispose, after its servers stop.
      testEnd().disposeAtEnd(removeHost);
      return {
        ...inner,
        dispose: async () => {
          await inner.dispose();
          await removeHost();
        },
      };
    } catch (e) {
      await removeHost();
      throw e;
    }
  }
  const project = readProject(dir);
  const data = mkdtempSync(join(tmpdir(), "keel-e2e-data-"));
  const secret = randomBytes(32).toString("hex");
  const extra = typeof options.env === "function" ? options.env(data) : (options.env ?? {});
  const hosted = project.deployables.filter(
    (d) => d.adapter === "static" || (d.adapter === "client" && d.servedBy === undefined),
  );
  const nodes = project.deployables.filter((d) => d.adapter === "node");
  const hosts = new Map<string, StaticHost>();
  const procs = new Map<string, Proc>();
  const contexts: ContextRun[] = [];
  let stopped = false;

  const disposeAll = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    for (const c of contexts.splice(0)) await c.context.close().catch(() => undefined);
    await Promise.all([...procs.values()].map((p) => p.kill()));
    for (const h of hosts.values()) await h.close();
    await proxy?.close();
    rmSync(data, { recursive: true, force: true });
  };

  const peerPorts = new Map<string, number>();
  const missing = (d: Deployable): string | undefined => {
    const dist = join(dir, "dist", d.name);
    if (!existsSync(d.adapter === "node" ? join(dist, "server.mjs") : dist))
      return `dist/${d.name}/ is missing; run keel build`;
    const given = new Set(Object.keys(extra));
    const lacking = d.required.filter(
      (n) =>
        !OWN.has(n) &&
        !n.startsWith("KEEL_PEER_") &&
        !(n === "KEEL_DATABASE_URL" && d.storage !== "postgres") &&
        !given.has(n),
    );
    if (d.storage === "postgres" && !given.has("KEEL_DATABASE_URL") && !lacking.includes("KEEL_DATABASE_URL"))
      lacking.push("KEEL_DATABASE_URL");
    return lacking.length === 0 ? undefined : `env does not give ${lacking.join(", ")}`;
  };
  let proxy: ProxyServer | undefined;
  const routes = new Map<string, AnswerEntry>();
  try {
    for (const d of options.dev === true ? [] : [...hosted, ...nodes]) {
      const why = missing(d);
      if (why !== undefined) throw startFailure(d.name, why, []);
    }
    for (const d of options.dev === true ? [] : hosted) {
      const adapter = d.adapter === "static" ? "static" : "client";
      hosts.set(d.name, await hostStatic(d.name, join(dir, "dist", d.name), adapter));
    }
    for (const d of nodes) peerPorts.set(d.name, await freePort());
    const allow = [...hosts.values()].map((h) => h.origin);
    const portOf = (name: string): number => procs.get(name)?.port() ?? peerPorts.get(name) ?? 0;
    const envOf = (d: Deployable) => (port: number) =>
      serverEnv({ d, port, secret, data, nodes, portOf, allow, extra });
    const devAt = nodes[0];
    if (options.dev === true && devAt !== undefined)
      procs.set(devAt.name, devProc(dir, devAt.name, envOf(devAt), READY));
    else
      for (const d of nodes) {
        const file =
          d.storage === "file"
            ? ["--experimental-webstorage", `--localstorage-file=${join(data, `${d.name}.localstorage`)}`]
            : [];
        procs.set(
          d.name,
          spawnProc({
            name: d.name,
            cwd: dir,
            port: peerPorts.get(d.name) ?? 0,
            args: () => ["--disable-warning=ExperimentalWarning", ...file, join(dir, "dist", d.name, "server.mjs")],
            env: envOf(d),
            readyMs: READY,
            waitListen: true,
          }),
        );
      }
    await Promise.all(
      [...procs.values()].map((p) =>
        p.start().catch((e: unknown) => {
          throw startFailure(p.name, e instanceof Error ? e.message : String(e), p.log);
        }),
      ),
    );
    for (const [o, a] of Object.entries(options.origins ?? {})) {
      const entry = answerEntries.get(a);
      if (entry === undefined) throw e2eError("E1736", `origins ${o}: not a live answer() handle`, { origin: o });
      routes.set(originOf(o), entry);
    }
    proxy = await startProxy(routes, (name) => procs.get(name)?.port());
  } catch (e) {
    await disposeAll();
    throw e;
  }

  const first = project.deployables[0]?.name;
  const originFor = (name = first): string => {
    const d = project.deployables.find((x) => x.name === name);
    if (d === undefined) throw e2eError("E1736", `no deployable ${name ?? ""} in topology.ts`, { deployable: name });
    const at = d.adapter === "client" && d.servedBy !== undefined ? d.servedBy : d.name;
    const host = hosts.get(at);
    if (host !== undefined) return host.origin;
    // `keel dev` serves every deployable from its one process.
    const p = options.dev === true ? [...procs.values()][0] : procs.get(at);
    if (p === undefined) throw e2eError("E1736", `${at} is served by no process of this serve`, { deployable: at });
    return `http://127.0.0.1:${p.port()}`;
  };

  const marks = new Map<string, number>();
  let failing: Map<string, number> | undefined;
  const mark = (): void => {
    failing = undefined;
    for (const [name, p] of procs) marks.set(name, p.log.length);
  };

  const sourceOf = (store: Store<unknown>): StoreSource => {
    const mod = store.id.split(".")[0] ?? "";
    const d = nodes.find((n) => n.modules.includes(mod)) ?? nodes[0];
    if (d === undefined) throw e2eError("E1736", `state ${store.id}: this serve has no node deployable`, {});
    if (d.storage === "postgres") return { kind: "postgres", url: extra.KEEL_DATABASE_URL ?? "", project: dir };
    if (d.storage === "sqlite") return { kind: "sqlite", file: join(data, `${d.name}.sqlite`) };
    return { kind: "file", file: join(data, `${d.name}.localstorage`) };
  };
  const readWith = async <T>(reader: StoreReader, store: Store<T>): Promise<T> => {
    const text = await reader.get(`keel.store.${store.id}`);
    if (text === undefined) return store.snapshot().state;
    const held: unknown = JSON.parse(text);
    const value = typeof held === "object" && held !== null ? Reflect.get(held, "state") : undefined;
    const r = store.check(value);
    if (!r.ok) throw e2eError("E1736", `state ${store.id}: the stored value does not parse: ${r.error.message}`, {});
    return r.value;
  };
  const logOf = async (store: Store<unknown>): Promise<StoreLog> => {
    const reader = await openStore(sourceOf(store));
    try {
      const text = await reader.get(`keel.store.${store.id}`);
      const sha = (t: string): string => createHash("sha256").update(t, "utf8").digest("hex");
      if (text === undefined) return { head: 0, digest: "", entries: [] };
      const held: unknown = JSON.parse(text);
      const head = typeof held === "object" && held !== null ? Reflect.get(held, "head") : undefined;
      const log: unknown = typeof held === "object" && held !== null ? Reflect.get(held, "log") : undefined;
      const entries = (Array.isArray(log) ? log : []).flatMap((e: unknown) => {
        const id: unknown = typeof e === "object" && e !== null ? Reflect.get(e, "id") : undefined;
        const name: unknown = typeof e === "object" && e !== null ? Reflect.get(e, "name") : undefined;
        const payload: unknown = typeof e === "object" && e !== null ? Reflect.get(e, "payload") : undefined;
        const digest = sha(JSON.stringify(payload) ?? "");
        return typeof id === "number" && typeof name === "string" ? [{ id, name, digest }] : [];
      });
      return { head: typeof head === "number" ? head : 0, digest: sha(text), entries };
    } finally {
      await reader.close();
    }
  };
  const state = async <T>(store: Store<T>): Promise<T> => {
    const reader = await openStore(sourceOf(store));
    try {
      return await readWith(reader, store);
    } finally {
      await reader.close();
    }
  };

  const served: Served = {
    origin: (deployable) => originFor(deployable),
    open: async (path, opts = {}) => {
      mark();
      const base = originFor(opts.deployable);
      return openContext({
        project,
        origin: base,
        path,
        scripts: opts.scripts !== false,
        hold: opts.hold === true,
        cookies: opts.cookies ?? [],
        proxy: proxy?.server ?? "",
        mapped: routes.size > 0,
        reaches: (origin) =>
          routes.has(origin) ||
          /^http:\/\/[a-z0-9-]+\.peer\.keel\.test$/.test(origin) ||
          [...hosts.values()].some((h) => h.origin === origin) ||
          [...procs.values()].some((p) => origin === `http://127.0.0.1:${p.port()}`),
        verb: mark,
        failed: () => {
          failing = new Map(marks);
        },
        contexts,
      });
    },
    fetch: (path, init = {}) => {
      const { deployable, ...rest } = init;
      return fetch(new URL(path, originFor(deployable)).href, { ...rest, redirect: "manual" });
    },
    serverLog: (deployable) => {
      const name = deployable ?? nodes.find((n) => n.name === first)?.name ?? nodes[0]?.name;
      return name === undefined ? [] : [...(procs.get(name)?.log ?? [])];
    },
    state,
    log: (store) => logOf(store),
    until: async (store, test, wait) => {
      mark();
      const ms = boundMs(wait);
      const end = performance.now() + ms;
      const reader = await openStore(sourceOf(store));
      // A commit the storage reports wakes the next read; a storage reporting none is read every 100 ms.
      let wake: (() => void) | undefined;
      let committed = false;
      const unwatch = await reader.watch?.(() => {
        committed = true;
        wake?.();
      });
      try {
        for (;;) {
          const value = await readWith(reader, store);
          if (test(value)) return value;
          const left = end - performance.now();
          if (left <= 0) break;
          if (committed) {
            committed = false;
            continue;
          }
          await new Promise<void>((done) => {
            const timer = setTimeout(done, unwatch === undefined ? Math.min(POLL, left) : left);
            wake = () => {
              clearTimeout(timer);
              committed = false;
              done();
            };
          });
          wake = undefined;
        }
      } finally {
        unwatch?.();
        await reader.close();
      }
      failing = new Map(marks);
      throw e2eError("E1735", `until ${store.id}: no commit made the test true after ${(ms / 1000).toFixed(1)}s`, {
        store: store.id,
      });
    },
    stop: async (deployable, how = {}) => {
      for (const [name, p] of procs) {
        if (deployable !== undefined && deployable !== name) continue;
        if (how.drain !== true) {
          await p.kill();
          continue;
        }
        // SIGTERM: the server stops listening, awaits its close() and exits (k.deploy).
        const code = await p.drain();
        if (code !== 0)
          throw e2eError(
            "E1737",
            `${name} did not drain: it exited ${typeof code === "number" ? `with code ${code}` : code}`,
            {
              deployable: name,
              records: p.log.slice(-LAST),
            },
          );
      }
    },
    start: async (deployable) => {
      for (const [name, p] of procs)
        if ((deployable === undefined || deployable === name) && !p.running())
          await p.start().catch((e: unknown) => {
            throw startFailure(name, e instanceof Error ? e.message : String(e), p.log);
          });
    },
    dispose: disposeAll,
  };

  testEnd().serveAtEnd({
    tabs: () => contexts.flatMap((c) => c.tabs.map((t) => t.tab)),
    contexts: () => contexts.map((c) => c.context),
    failureRecords: () => {
      const from = failing ?? marks;
      return [...procs].flatMap(([name, p]) => p.log.slice(from.get(name) ?? 0).map(compactRecord));
    },
    unread: () => contexts.flatMap((c) => c.tabs.flatMap((t) => t.problems)),
    dispose: disposeAll,
  });
  return served;
}
