// Fixture for std.channels conformance: one createApp serving two modules, each with its own channel route and config.
// Assumptions: as fixtures.ts; module `a` and `b` each declare `std: { '@keel/std-channels': { ... } }`; `member` is true for every caller.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stdArtifact } from "@keel/compiler";
import { createCtx } from "@keel/ctx";
import { manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { channel } from "@keel/std-channels";
import { channelRoute } from "@keel/std-channels/server";
import { store, transaction } from "@keel/store";
import { BASE, field } from "./fixtures.ts";

const Counter = s.object({ n: s.int() });
const Nothing = s.object({});
const Msg = s.object({ text: s.string() });

export interface Cfg {
  readonly perCaller?: number;
  readonly perAnonymous?: number;
  readonly maxStreams?: number;
}

export type ModuleId = "a" | "b";

export const pathOf = (m: ModuleId): string => `/api/${m}/events`;

export interface Opened {
  readonly status: number;
  /** Events delivered so far (the `value` of each `ok` data line). */
  readonly events: unknown[];
  ended(): boolean;
  close(): void;
}

export interface TwoModules {
  open(m: ModuleId, cookie?: string): Promise<Opened>;
  mint(): Promise<string>;
  dispose(): Promise<void>;
}

const given = (c: Cfg): string =>
  [
    ...(c.perCaller === undefined ? [] : [`perCaller: ${c.perCaller}`]),
    ...(c.perAnonymous === undefined ? [] : [`perAnonymous: ${c.perAnonymous}`]),
    ...(c.maxStreams === undefined ? [] : [`maxStreams: ${c.maxStreams}`]),
  ].join(", ");

const moduleSource = (id: ModuleId, c: Cfg): { path: string; source: string } => ({
  path: `modules/${id}/module.ts`,
  source: `import { module } from "@keel/compiler"\nexport default module({ id: "${id}", deps: ["@keel/std-channels"], capabilities: ["clock", "net", "observe"], std: { "@keel/std-channels": { ${given(c)} } } })\n`,
});

function tableA() {
  const Params = s.object({});
  const ch = channel("a.room", { path: pathOf("a"), params: Params, message: Msg });
  const c = contract("a", {
    "a.room": { method: "GET", path: "/api/a/events", query: Params, events: true, output: ch.events },
    "a.publish": { method: "POST", path: "/api/a/events", query: Params, body: ch.body, output: s.object({}) },
  });
  const r = channelRoute(c, ch, {
    id: "a.room",
    publish: "a.publish",
    stores: () => {
      const log = store(Counter, { n: 0 }, { id: "a.log" });
      const bump = transaction(log, "a.bump", Nothing, (st) => ({ n: st.n + 1 }));
      return { log, bump };
    },
    member: () => true,
  });
  return manifest(c, { "a.room": { loader: r.loader }, "a.publish": { action: r.action } });
}

function tableB() {
  const Params = s.object({});
  const ch = channel("b.room", { path: pathOf("b"), params: Params, message: Msg });
  const c = contract("b", {
    "b.room": { method: "GET", path: "/api/b/events", query: Params, events: true, output: ch.events },
    "b.publish": { method: "POST", path: "/api/b/events", query: Params, body: ch.body, output: s.object({}) },
  });
  const r = channelRoute(c, ch, {
    id: "b.room",
    publish: "b.publish",
    stores: () => {
      const log = store(Counter, { n: 0 }, { id: "b.log" });
      const bump = transaction(log, "b.bump", Nothing, (st) => ({ n: st.n + 1 }));
      return { log, bump };
    },
    member: () => true,
  });
  return manifest(c, { "b.room": { loader: r.loader }, "b.publish": { action: r.action } });
}

export async function serveTwo(a: Cfg, b: Cfg): Promise<TwoModules> {
  const routes = routeTable(tableA(), tableB());
  const dir = mkdtempSync(join(tmpdir(), "keel-channels2-"));
  const std = join(dir, "std.json");
  const { data, hash } = stdArtifact([moduleSource("a", a), moduleSource("b", b)]);
  writeFileSync(std, JSON.stringify({ data, hash }));
  const app = await createApp({
    topology: topology({ web: { modules: ["a", "b"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
    std,
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
    open: async (m, cookie) => {
      const ac = new AbortController();
      const res = await app.fetch(
        new Request(`${BASE}${pathOf(m)}`, {
          headers: { accept: "text/event-stream", ...(cookie === undefined ? {} : { cookie }) },
          signal: ac.signal,
        }),
      );
      const events: unknown[] = [];
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
            buf += dec.decode(r.value, { stream: true });
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
      return { status: res.status, events, ended: () => done.ended, close: () => ac.abort() };
    },
    dispose: async () => {
      const close: unknown = Reflect.get(Object(app), "close");
      if (typeof close === "function") await Reflect.apply(close, app, []);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
