// Fixture for std.channels-limits conformance: one createApp serving one to three modules `a`, `b`, `c`, each with its own channel route and its own config.
// Assumptions: as twoModules.ts. `member` is true for every caller unless a module sets `refuseAnonymous` (then false for caller `""`).
// With `identity: true` the identity source answers `user:<sid>` for a request whose cookie holds `sid=<sid>`, else `""` (a person signed in, whatever their caller cookie).
// `appMaxStreams` is `createApp({ maxStreams })`.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stdArtifact } from "@keel/compiler";
import { createCtx } from "@keel/ctx";
import { manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import { channel } from "@keel/std-channels";
import { channelRoute } from "@keel/std-channels/server";
import { store, transaction } from "@keel/store";
import { BASE, field } from "./fixtures.ts";

const Counter = s.object({ n: s.int() });
const Nothing = s.object({});
const Msg = s.object({ text: s.string() });

export type Mod = "a" | "b" | "c";
export const MODS: readonly Mod[] = ["a", "b", "c"];

export interface Cfg {
  readonly perCaller?: number;
  readonly perAnonymous?: number;
  readonly maxStreams?: number;
  /** `member` is false for caller `""`. */
  readonly refuseAnonymous?: boolean;
}

export const pathOf = (m: Mod): string => `/api/${m}/events`;

export interface Opened {
  readonly status: number;
  readonly events: unknown[];
  raw(): string;
  ended(): boolean;
  close(): void;
}

export interface OpenOptions {
  /** The whole `cookie` header value, for example `keel-caller=<v>` or `sid=u1; keel-caller=<v>`. */
  readonly cookie?: string;
  /** Sent as `x-forwarded-for`: Keel counts no address. */
  readonly address?: string;
}

export interface Modules {
  open(m: Mod, o?: OpenOptions): Promise<Opened>;
  /** A fresh caller cookie (`keel-caller=<v>`), minted by a write. */
  mint(): Promise<string>;
  dispose(): Promise<void>;
}

const given = (c: Cfg): string =>
  [
    ...(c.perCaller === undefined ? [] : [`perCaller: ${c.perCaller}`]),
    ...(c.perAnonymous === undefined ? [] : [`perAnonymous: ${c.perAnonymous}`]),
    ...(c.maxStreams === undefined ? [] : [`maxStreams: ${c.maxStreams}`]),
  ].join(", ");

const moduleSource = (id: Mod, c: Cfg): { path: string; source: string } => ({
  path: `modules/${id}/module.ts`,
  source: `import { module } from "@keel/compiler"\nexport default module({ id: "${id}", deps: ["@keel/std-channels"], capabilities: ["clock", "net", "observe"], std: { "@keel/std-channels": { ${given(c)} } } })\n`,
});

function tableA(c: Cfg) {
  const Params = s.object({});
  const ch = channel("a.room", { path: pathOf("a"), params: Params, message: Msg });
  const k = contract("a", {
    "a.room": { method: "GET", path: "/api/a/events", query: Params, events: true, output: ch.events },
    "a.publish": { method: "POST", path: "/api/a/events", query: Params, body: ch.body, output: s.object({}) },
  });
  const r = channelRoute(k, ch, {
    id: "a.room",
    publish: "a.publish",
    stores: () => {
      const log = store(Counter, { n: 0 }, { id: "a.log" });
      const bump = transaction(log, "a.bump", Nothing, (st) => ({ n: st.n + 1 }));
      return { log, bump };
    },
    member: ({ caller }) => !(c.refuseAnonymous === true && caller === ""),
  });
  return manifest(k, { "a.room": { loader: r.loader }, "a.publish": { action: r.action } });
}

function tableB(c: Cfg) {
  const Params = s.object({});
  const ch = channel("b.room", { path: pathOf("b"), params: Params, message: Msg });
  const k = contract("b", {
    "b.room": { method: "GET", path: "/api/b/events", query: Params, events: true, output: ch.events },
    "b.publish": { method: "POST", path: "/api/b/events", query: Params, body: ch.body, output: s.object({}) },
  });
  const r = channelRoute(k, ch, {
    id: "b.room",
    publish: "b.publish",
    stores: () => {
      const log = store(Counter, { n: 0 }, { id: "b.log" });
      const bump = transaction(log, "b.bump", Nothing, (st) => ({ n: st.n + 1 }));
      return { log, bump };
    },
    member: ({ caller }) => !(c.refuseAnonymous === true && caller === ""),
  });
  return manifest(k, { "b.room": { loader: r.loader }, "b.publish": { action: r.action } });
}

function tableC(c: Cfg) {
  const Params = s.object({});
  const ch = channel("c.room", { path: pathOf("c"), params: Params, message: Msg });
  const k = contract("c", {
    "c.room": { method: "GET", path: "/api/c/events", query: Params, events: true, output: ch.events },
    "c.publish": { method: "POST", path: "/api/c/events", query: Params, body: ch.body, output: s.object({}) },
  });
  const r = channelRoute(k, ch, {
    id: "c.room",
    publish: "c.publish",
    stores: () => {
      const log = store(Counter, { n: 0 }, { id: "c.log" });
      const bump = transaction(log, "c.bump", Nothing, (st) => ({ n: st.n + 1 }));
      return { log, bump };
    },
    member: ({ caller }) => !(c.refuseAnonymous === true && caller === ""),
  });
  return manifest(k, { "c.room": { loader: r.loader }, "c.publish": { action: r.action } });
}

export interface ServeOptions {
  readonly identity?: boolean;
  readonly appMaxStreams?: number;
}

/** Serves modules `a`, `b`, `c` in order, one per config given (one to three). */
export async function serveModules(cfgs: readonly Cfg[], o: ServeOptions = {}): Promise<Modules> {
  const mods = MODS.slice(0, cfgs.length);
  const tables = mods.map((m, i) => (m === "a" ? tableA : m === "b" ? tableB : tableC)(cfgs[i] ?? {}));
  const [first, ...rest] = tables;
  if (first === undefined) throw new Error("serveModules: at least one module");
  const routes = routeTable(first, ...rest);
  const dir = mkdtempSync(join(tmpdir(), "keel-channels-limits-"));
  const std = join(dir, "std.json");
  const { data, hash } = stdArtifact(mods.map((m, i) => moduleSource(m, cfgs[i] ?? {})));
  writeFileSync(std, JSON.stringify({ data, hash }));
  const app = await createApp({
    topology: topology({ web: { modules: [...mods], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
    std,
    ...(o.appMaxStreams === undefined ? {} : { maxStreams: o.appMaxStreams }),
    ...(o.identity === true
      ? {
          identity: identity({
            identify: async ({ request }) => {
              const m = /(?:^|;\s*)sid=([^;]*)/.exec(request.headers.get("cookie") ?? "");
              return m?.[1] === undefined ? "" : `user:${m[1]}`;
            },
          }),
        }
      : {}),
  });
  return {
    mint: async () => {
      const res = await app.fetch(
        new Request(`${BASE}${pathOf("a")}`, {
          method: "POST",
          body: JSON.stringify({ message: { text: "x" } }),
          headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1", origin: BASE },
        }),
      );
      if (res.status !== 200) throw new Error(`mint answered ${res.status}`);
      return (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    },
    open: async (m, opened = {}) => {
      const ac = new AbortController();
      const res = await app.fetch(
        new Request(`${BASE}${pathOf(m)}`, {
          headers: {
            accept: "text/event-stream",
            ...(opened.cookie === undefined ? {} : { cookie: opened.cookie }),
            ...(opened.address === undefined ? {} : { "x-forwarded-for": opened.address }),
          },
          signal: ac.signal,
        }),
      );
      const events: unknown[] = [];
      const raw = { text: "" };
      const done = { ended: false };
      const reader = res.body?.getReader();
      const pump = async (): Promise<void> => {
        if (reader === undefined) {
          done.ended = true;
          return;
        }
        const dec = new TextDecoder();
        let buf = "";
        try {
          for (;;) {
            const r = await reader.read();
            if (r.done) break;
            const chunk = dec.decode(r.value, { stream: true });
            raw.text += chunk;
            buf += chunk;
            const cut = buf.lastIndexOf("\n");
            if (cut < 0) continue;
            const lines = buf.slice(0, cut).split("\n");
            buf = buf.slice(cut + 1);
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const parsed: unknown = JSON.parse(line.slice(5));
              events.push(field(parsed, "ok") === true ? field(parsed, "value") : parsed);
            }
          }
        } catch {
          // an aborted request ends the pump
        }
        done.ended = true;
      };
      void pump();
      return { status: res.status, events, raw: () => raw.text, ended: () => done.ended, close: () => ac.abort() };
    },
    dispose: async () => {
      const close: unknown = Reflect.get(Object(app), "close");
      if (typeof close === "function") await Reflect.apply(close, app, []);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
