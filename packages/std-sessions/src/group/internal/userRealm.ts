import type { MessagePort } from "node:worker_threads";
import { Schedule, type SimCtx, createCtx } from "@keel/ctx";
import type { Manifest, RouteDef } from "@keel/router";
import { type JsonValue, s } from "@keel/schema";
import { type RouteHarness, renderRoute } from "@keel/testing";
import type { Recorder } from "../../Recorder.ts";
import { Session } from "../../Session.schema.ts";
import { SessionEvent } from "../../SessionEvent.ts";
import { applyInput } from "../../internal/applyInput.ts";
import { decoded } from "../../internal/decoded.ts";
import { jsonOf } from "../../internal/jsonOf.ts";
import { liveState } from "../../internal/liveState.ts";
import { replayStep } from "../../internal/replayStep.ts";
import { reportUnapplied } from "../../internal/reportUnapplied.ts";
import { seededState } from "../../internal/seededState.ts";
import { record } from "../../record.ts";
import { field } from "./field.ts";
import { wire } from "./wire.ts";

type Table = Manifest<Readonly<Record<string, RouteDef>>>;
type Pending = {
  readonly resolve: (res: Response) => void;
  readonly reject: (error: Error) => void;
  body?: ReadableStreamDefaultController<Uint8Array>;
};

const Open = s.object({
  user: s.string(),
  seed: s.number(),
  origin: s.string(),
  at: s.number(),
  session: Session.nullable(),
  schedule: Schedule.nullable(),
});
const Base = s.object({ id: s.string(), params: s.record(s.json()), search: s.record(s.json()) });
const Id = s.object({ id: s.string() });
const Href = s.object({ href: s.string() });
const Online = s.object({ online: s.boolean() });
const Ms = s.object({ ms: s.number() });
const Index = s.object({ index: s.number() });
/** Statuses whose response has no body. */
const EMPTY = new Set([101, 204, 205, 304]);

function isTable(x: unknown): x is Table {
  return typeof field(x, "routes") === "object" && typeof field(x, "href") === "function";
}

function parsed<T>(schema: { parse(x: unknown): { ok: true; value: T } | { ok: false } }, x: unknown, what: string): T {
  const r = schema.parse(x);
  if (!r.ok) throw new TypeError(`group: bad ${what}`);
  return r.value;
}

/**
 * One group user (std.multi), in its worker: answers its group's calls on `port`. `open` loads the user module with
 * `load` (the worker's project loader, which loaded this module too) and,
 * live, renders its `base` at `at` (on a sim ctx with its `schedule`, when the group has one) under `record(ctx, { limit: Infinity })` on a sim ctx of the user's seed, or, for a
 * replay, renders a session's base as std.sessions `replay` does. Requests to `origin` go to the group's server over
 * `port`, their bodies streamed back (a body the user cancels is cancelled at the server); other URLs get the sim
 * net's 404.
 */
export function userRealm(port: MessagePort, load: (url: string) => Promise<unknown>): void {
  const pending = new Map<number, Pending>();
  let nextRid = 0;
  let ctx: SimCtx | undefined;
  let routes: Table | undefined;
  let h: RouteHarness<unknown> | undefined;
  let rec: Recorder | undefined;
  let replaying: Session | null = null;
  let unapplied: number | null = null;
  let step: ((e: SessionEvent) => Promise<boolean>) | undefined;

  const bridge = async (req: Request): Promise<Response> => {
    const rid = nextRid++;
    const body = req.method === "GET" || req.method === "HEAD" ? null : new Uint8Array(await req.arrayBuffer());
    return new Promise((resolve, reject) => {
      pending.set(rid, { resolve, reject });
      port.postMessage({ t: "req", rid, method: req.method, url: req.url, headers: [...req.headers], body });
    });
  };

  const onHead = (m: unknown): void => {
    const r = wire.head.parse(m);
    if (!r.ok) return;
    const p = pending.get(r.value.rid);
    if (p === undefined) return;
    const headers = new Headers();
    for (const [k, v] of r.value.headers) if (k !== undefined && v !== undefined) headers.append(k, v);
    const init = { status: r.value.status, statusText: r.value.statusText, headers };
    if (EMPTY.has(r.value.status)) {
      pending.delete(r.value.rid);
      p.resolve(new Response(null, init));
      return;
    }
    const rid = r.value.rid;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        p.body = c;
      },
      // A body the user cancels is done here: later chunks are dropped, and the server's stream is cancelled too.
      cancel() {
        pending.delete(rid);
        port.postMessage({ t: "cancel", rid });
      },
    });
    p.resolve(new Response(stream, init));
  };
  const onEnd = (m: unknown): void => {
    const r = wire.end.parse(m);
    if (!r.ok) return;
    const p = pending.get(r.value.rid);
    if (p === undefined) return;
    pending.delete(r.value.rid);
    const error = r.value.error === undefined ? undefined : new TypeError(r.value.error);
    if (p.body === undefined) p.reject(error ?? new TypeError("group: response ended before its head"));
    else if (error === undefined) p.body.close();
    else p.body.error(error);
  };
  const onChunk = (m: unknown): void => {
    const data = field(m, "data");
    const rid = field(m, "rid");
    const c = typeof rid === "number" ? pending.get(rid)?.body : undefined;
    if (c !== undefined && data instanceof Uint8Array) c.enqueue(data);
  };

  const harness = (): RouteHarness<unknown> => {
    if (h === undefined) throw new Error("group: user is not open");
    return h;
  };
  const simCtx = (): SimCtx => {
    if (ctx === undefined) throw new Error("group: user is not open");
    return ctx;
  };
  const table = (): Table => {
    if (routes === undefined) throw new Error("group: user is not open");
    return routes;
  };
  const stateJson = (state: Readonly<Record<string, unknown>>): { [store: string]: JsonValue } => {
    const out: { [store: string]: JsonValue } = {};
    for (const [id, v] of Object.entries(state)) out[id] = jsonOf(v);
    return out;
  };

  const open = async (arg: unknown): Promise<null> => {
    const o = parsed(Open, arg, "open");
    const mod = await load(o.user);
    const table = field(mod, "routes");
    if (!isTable(table)) throw new TypeError(`group: ${o.user} exports no routes`);
    routes = table;
    const c = createCtx({ mode: "sim", seed: o.seed, ...(o.schedule === null ? {} : { schedule: o.schedule }) });
    ctx = c;
    c.net.route(`${o.origin}/*`, bridge);
    if (o.at > c.clock.now()) c.clock.advance(o.at - c.clock.now());
    rec = record(c, { limit: Number.POSITIVE_INFINITY });
    replaying = o.session;
    if (o.session === null) {
      const base = parsed(Base, field(mod, "base"), `base of ${o.user}`);
      h = await renderRoute(base.id, { routes: table, params: base.params, search: base.search, ctx: c });
      return null;
    }
    const session = o.session;
    const def = Object.hasOwn(table.routes, session.route.id) ? table.routes[session.route.id] : undefined;
    if (def?.path === undefined) {
      unapplied = -1;
      return null;
    }
    try {
      const r = await renderRoute(session.route.id, {
        routes: table,
        params: decoded(def.params, session.route.params),
        search: decoded(def.search, session.route.search),
        state: seededState(session.state),
        ctx: c,
      });
      h = r;
      step = replayStep(rec, (e) => applyInput(r, table, c, e));
    } catch {
      unapplied = -1;
    }
    return null;
  };

  const apply = async (arg: unknown): Promise<boolean> => {
    const { index } = parsed(Index, arg, "apply");
    const e = replaying?.events[index];
    if (unapplied !== null || step === undefined || e === undefined) return false;
    const ok = await step(e);
    if (!ok) {
      unapplied = index;
      reportUnapplied(simCtx(), index);
    }
    return ok;
  };

  const finish = (): JsonValue => {
    const session = replaying;
    if (session === null || rec === undefined) throw new Error("group: user is not replaying");
    const end = h === undefined ? liveState() : h.state();
    const out = rec.stop();
    h?.dispose();
    h = undefined;
    return {
      observed: out.events.filter((e) => e.kind !== "fire" && e.kind !== "nav"),
      state: stateJson(end),
      error: out.error,
      reproduced: out.fingerprint === session.fingerprint,
      unapplied,
    };
  };

  const ops: { readonly [op: string]: (arg: unknown) => Promise<JsonValue> | JsonValue } = {
    open,
    apply,
    finish,
    fire: async (arg) => {
      const e = parsed(SessionEvent, arg, "fire");
      if (e.kind !== "fire") throw new TypeError("group: bad fire");
      await harness().fire(e.id, e.event);
      return null;
    },
    navigate: async (arg) => {
      const { href } = parsed(Href, arg, "navigate");
      if (!(await applyInput(harness(), table(), simCtx(), { at: 0, kind: "nav", href })))
        throw new TypeError(`group: no route matches ${href}`);
      return null;
    },
    find: (arg) => {
      const f = harness().find(parsed(Id, arg, "find").id);
      return { id: f.id, role: f.role, name: f.name, text: f.text, state: { ...f.state } };
    },
    state: () => stateJson(harness().state()),
    setOnline: async (arg) => {
      simCtx().net.setOnline(parsed(Online, arg, "setOnline").online);
      await h?.settle();
      return null;
    },
    advanceTo: (arg) => {
      const c = simCtx();
      const { ms } = parsed(Ms, arg, "advanceTo");
      if (ms > c.clock.now()) c.clock.advance(ms - c.clock.now());
      return null;
    },
    settle: async () => {
      await h?.settle();
      return null;
    },
    stop: () => {
      if (rec === undefined) throw new Error("group: user is not open");
      const out = rec.stop();
      h?.dispose();
      h = undefined;
      return Session.encode(out);
    },
  };

  const call = async (m: unknown): Promise<void> => {
    const r = wire.call.parse(m);
    if (!r.ok) return;
    const { id, op, arg } = r.value;
    try {
      const run = Object.hasOwn(ops, op) ? ops[op] : undefined;
      if (run === undefined) throw new TypeError(`group: unknown call ${op}`);
      port.postMessage({ t: "ret", id, ok: true, value: await run(arg) });
    } catch (error) {
      const code = field(error, "code");
      port.postMessage({
        t: "ret",
        id,
        ok: false,
        value: null,
        message: error instanceof Error ? error.message : String(error),
        ...(typeof code === "string" ? { code } : {}),
      });
    }
  };

  port.on("message", (m: unknown) => {
    const t = field(m, "t");
    if (t === "call") void call(m);
    else if (t === "head") onHead(m);
    else if (t === "chunk") onChunk(m);
    else if (t === "end") onEnd(m);
  });
}
