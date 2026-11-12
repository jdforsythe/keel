// Shared fixtures for std.offline conformance. Seed 1337 (every property passes { seed: 1337 }).
// The server is a set of sim net routes over a real k.store store: a POST applies `tx(edit, payload, { ...write })`,
// so k.sync's base check and write key decide 409 and duplicates exactly as an action would. No wall clock, no random, no timers.
// Assumption: `ctx.net.route(url, handler)`, `ctx.net.setOnline(b)` and `ctx.clock.advance(ms)` are the sim spellings.
// Assumption: a 2xx body is the endpoint's `output` as JSON (k.services); a refusal is `{ ok: false, error }` JSON with
// status 409, and the endpoint declares `errors: { 409: s.json() }` so the client hands the body to the outbox.
// Assumption: `outbox(...)` returns the client store itself (`log()`, `get('entries')`), and its state is `{ entries }`.
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import { Write, drain, outbox } from "@keel/std-offline";
import { store, transaction, tx } from "@keel/store";

export const SEED = 1337;
export const ORIGIN = "https://app.example.com";
export const TODOS = ["t1", "t2", "t3"] as const;

export const simCtx = (seed = SEED): SimCtx => createCtx({ mode: "sim", seed });

export const settle = async (): Promise<void> => {
  for (let i = 0; i < 400; i++) await Promise.resolve();
};

export const tick = async (ctx: SimCtx, ms: number): Promise<void> => {
  ctx.clock.advance(ms);
  await settle();
};

export const Api = endpoints({
  editTodo: {
    method: "POST",
    path: "/todos/:todoId",
    params: s.object({ todoId: s.string() }),
    body: s.object({ title: s.string(), write: Write }),
    output: s.object({ head: s.int(), title: s.string() }),
    errors: { 409: s.json(), 500: s.json() },
  },
});

export interface Post {
  readonly url: string;
  readonly todoId: string;
  readonly title: string;
  readonly key: string;
  readonly base: number;
  readonly at: number;
}

export type Behavior =
  | { kind: "apply" }
  | { kind: "lose" } // commit, then reject the fetch (the response is lost)
  | { kind: "reject" } // reject the fetch without committing
  | { kind: "overlap" } // 409 keel.conflict with no `data.transaction`
  | { kind: "status"; status: number }
  | { kind: "unreachable" }; // 502 JSON keel.unreachable

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** One sim server. `script` is the queue of behaviors for successive posts; an empty queue means `apply`. */
export function createServer() {
  const made: { st?: ReturnType<typeof build> } = {};
  scope(() => {
    made.st = build();
  });
  const st = made.st;
  if (st === undefined) throw new Error("server store did not build");
  const posts: Post[] = [];
  const script: Behavior[] = [];
  const gate: { on: boolean; waiting: (() => void)[] } = { on: false, waiting: [] };
  const handler =
    (todoId: string, ctx: SimCtx) =>
    async (req: Request): Promise<Response> => {
      const body: unknown = await req.json();
      const title: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "title") : undefined;
      const write: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "write") : undefined;
      const key: unknown = typeof write === "object" && write !== null ? Reflect.get(write, "key") : undefined;
      const base: unknown = typeof write === "object" && write !== null ? Reflect.get(write, "base") : undefined;
      if (typeof title !== "string" || typeof key !== "string" || typeof base !== "number")
        return json(422, { ok: false });
      posts.push({ url: req.url, todoId, title, key, base, at: ctx.clock.now() });
      if (gate.on) await new Promise<void>((go) => gate.waiting.push(go));
      const behavior = script.shift() ?? { kind: "apply" };
      switch (behavior.kind) {
        case "reject":
          throw new TypeError("network down");
        case "overlap":
          return json(409, { ok: false, error: { code: "keel.conflict", message: "overlapped", data: {} } });
        case "status":
          return json(behavior.status, { ok: false, error: { code: "x.status", message: "status", data: {} } });
        case "unreachable":
          return json(502, { ok: false, error: { code: "keel.unreachable", message: "unreachable", data: {} } });
        default: {
          const r = tx(st.edit, { todoId, title }, { key, base });
          if (!r.ok) return json(409, { ok: false, error: r.error });
          if (behavior.kind === "lose") throw new TypeError("response lost");
          return json(200, { head: st.store.head(), title });
        }
      }
    };
  return {
    attach(ctx: SimCtx): void {
      for (const todoId of TODOS) ctx.net.route(`${ORIGIN}/todos/${todoId}`, handler(todoId, ctx));
    },
    /** Queue behaviors for the next posts. */
    next(...b: Behavior[]): void {
      script.push(...b);
    },
    /** A write by another caller: moves the server's head. */
    other(todoId: string, title: string): void {
      tx(st.edit, { todoId, title });
    },
    /** While gated, every post waits for `release()` before the server answers it. */
    gated(on: boolean): void {
      gate.on = on;
    },
    release(): void {
      gate.waiting.shift()?.();
    },
    posts,
    head: (): number => st.store.head(),
    entries: (): readonly { todoId: string; title: string }[] => st.store.get("entries"),
    log: (): string => JSON.stringify(st.store.log()),
  };
}

function build() {
  const Entry = s.object({ todoId: s.string(), title: s.string() });
  const state = store(
    s.object({ entries: s.array(Entry) }),
    { entries: [] },
    { id: `server.todos.${++serverCounter}` },
  );
  const edit = transaction(state, "todos.edit", Entry, (st, p) => ({ entries: [...st.entries, p] }));
  return { store: state, edit };
}
let serverCounter = 0;

let outboxCounter = 0;

const declare = (id: string, opts: { limit?: number; maxBytes?: number }) => outbox(id, Api, opts);

/** A client: an outbox declared in its own scope (a store needs an owner). Ids are unique per call so scopes may overlap. */
export function makeClient(opts: { limit?: number; maxBytes?: number; id?: string } = {}) {
  const id = opts.id ?? `t${++outboxCounter}.outbox`;
  const held: { o?: ReturnType<typeof declare> } = {};
  const sc = scope(() => {
    held.o = declare(id, {
      ...(opts.limit === undefined ? {} : { limit: opts.limit }),
      ...(opts.maxBytes === undefined ? {} : { maxBytes: opts.maxBytes }),
    });
  });
  const o = held.o;
  if (o === undefined) throw new Error("outbox did not build");
  return { o, id, storageKey: `keel.outbox.${id}`, dispose: () => sc.dispose() };
}

/** `drain(ctx, o)` inside its own scope; the returned function disposes that scope. */
export function startDrain(ctx: SimCtx, o: ReturnType<typeof declare>): () => void {
  const sc = scope(() => {
    void drain(ctx, o);
  });
  return () => sc.dispose();
}

/** Copies the persisted outbox from one sim ctx's storage to another's (the same browser storage, a new ctx). */
export async function copyStorage(from: SimCtx, to: SimCtx, key: string): Promise<void> {
  const raw: unknown = await from.storage.get(key);
  if (typeof raw === "string") await to.storage.set(key, raw);
}

export type Input = { params: { todoId: string }; body: { title: string } };
export const edit = (todoId: string, title: string): Input => ({ params: { todoId }, body: { title } });

/** The persisted outbox under `keel.outbox.<id>` as entries, whether storage holds a string or a value. */
export async function stored(
  ctx: SimCtx,
  key: string,
): Promise<{ key: string; state: string; base: number; title: string | undefined }[]> {
  const raw: unknown = await ctx.storage.get(key);
  const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  const entries: unknown = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null
      ? Reflect.get(parsed, "entries")
      : undefined;
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((e: unknown) => {
    if (typeof e !== "object" || e === null) return [];
    const k: unknown = Reflect.get(e, "key");
    const state: unknown = Reflect.get(e, "state");
    const base: unknown = Reflect.get(e, "base");
    const input: unknown = Reflect.get(e, "input");
    const body: unknown = typeof input === "object" && input !== null ? Reflect.get(input, "body") : undefined;
    const title: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "title") : undefined;
    return typeof k === "string" && typeof state === "string" && typeof base === "number"
      ? [{ key: k, state, base, title: typeof title === "string" ? title : undefined }]
      : [];
  });
}

/** The outbox store's entries as plain records. */
export function entriesOf(o: { get(k: "entries"): readonly unknown[] }): {
  key: string;
  state: string;
  base: number;
  head?: number;
  title?: string;
}[] {
  return o.get("entries").flatMap((e) => {
    if (typeof e !== "object" || e === null) return [];
    const key: unknown = Reflect.get(e, "key");
    const state: unknown = Reflect.get(e, "state");
    const base: unknown = Reflect.get(e, "base");
    const head: unknown = Reflect.get(e, "head");
    const input: unknown = Reflect.get(e, "input");
    const body: unknown = typeof input === "object" && input !== null ? Reflect.get(input, "body") : undefined;
    const title: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "title") : undefined;
    if (typeof key !== "string" || typeof state !== "string" || typeof base !== "number") return [];
    return [
      {
        key,
        state,
        base,
        ...(typeof head === "number" ? { head } : {}),
        ...(typeof title === "string" ? { title } : {}),
      },
    ];
  });
}

/** Names of the outbox log's entries, and the payload of each `<id>.resolve`. */
export function resolveLog(o: { log(): readonly { name: string; payload: unknown }[] }, id: string): unknown[] {
  return o
    .log()
    .filter((e) => e.name === `${id}.resolve`)
    .map((e) => e.payload);
}
