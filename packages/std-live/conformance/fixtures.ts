// Shared fixtures for std.live conformance. Seed 1337 (every property below passes { seed: 1337 }).
// The server is a sim net route set: one SSE route for the channel (a `reset` frame on open, `saved` frames on a save)
// and one JSON route for the board (GET reads, POST adds and saves). No wall clock, no random, no timers.
// Assumption: a frame is a k.server `Result` JSON on a `data:` line (k.server live loaders, k.services `events`).
// Assumption: `ctx.net.route(url, handler)` and `ctx.clock.advance(ms)` are the sim net and clock spellings.
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { err, ok, s } from "@keel/schema";
import type { KeelError, Result } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import { channel } from "@keel/std-channels";
import { live } from "@keel/std-live";
import { store, transaction } from "@keel/store";
import fc from "fast-check";

export const SEED = 1337;
export const ORIGIN = "https://app.example.com";
export const EVENTS_PATH = "/api/board/events";

export const Board = s.object({ head: s.int(), items: s.array(s.string()) });
export interface BoardValue {
  head: number;
  items: string[];
}
export const EMPTY: BoardValue = { head: 0, items: [] };
export const boardArb: fc.Arbitrary<BoardValue> = fc.record({
  head: fc.integer({ min: 0, max: 1000 }),
  items: fc.array(fc.string({ maxLength: 8 }), { maxLength: 6 }),
});

export const boardChannel = channel("todos.board", { path: EVENTS_PATH, params: s.object({}) });

export const simCtx = (seed = SEED): SimCtx => createCtx({ mode: "sim", seed });

export const settle = async (): Promise<void> => {
  for (let i = 0; i < 400; i++) await Promise.resolve();
};

export const tick = async (ctx: SimCtx, ms: number): Promise<void> => {
  ctx.clock.advance(ms);
  await settle();
};

export const api = service({
  base: ORIGIN,
  schema: endpoints({
    board: { method: "GET", path: "/api/board", output: Board },
    add: {
      method: "POST",
      path: "/api/board",
      body: s.object({ item: s.string() }),
      output: s.object({ head: s.int() }),
    },
  }),
});

type Controller = ReadableStreamDefaultController<Uint8Array>;
const enc = new TextEncoder();
const frame = (event: unknown): Uint8Array => enc.encode(`data: ${JSON.stringify({ ok: true, value: event })}\n\n`);
const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

/** One sim server for any number of ctxs: `attach(ctx)` routes that ctx's net to it. */
export function createServer() {
  const streams = new Set<Controller>();
  const state: { head: number; items: string[]; opens: number } = { head: 0, items: [], opens: 0 };
  const push = (event: unknown): void => {
    for (const c of [...streams]) {
      try {
        c.enqueue(frame(event));
      } catch {
        streams.delete(c);
      }
    }
  };
  const open = (req: Request): Response => {
    state.opens++;
    const held: { c?: Controller } = {};
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        held.c = c;
        streams.add(c);
        c.enqueue(frame({ kind: "reset" }));
        req.signal.addEventListener("abort", () => {
          streams.delete(c);
          try {
            c.close();
          } catch {
            // already closed or errored
          }
        });
      },
      cancel() {
        if (held.c !== undefined) streams.delete(held.c);
      },
    });
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  const board = async (req: Request): Promise<Response> => {
    if (req.method === "GET") return json({ head: state.head, items: state.items });
    const body: unknown = await req.json();
    const item: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "item") : undefined;
    if (typeof item !== "string") return new Response("{}", { status: 422 });
    save(item);
    return json({ head: state.head });
  };
  const save = (item: string): void => {
    state.head++;
    state.items.push(item);
    push({ kind: "saved", store: "board", head: state.head });
  };
  return {
    attach(ctx: SimCtx): void {
      ctx.net.route(`${ORIGIN}${EVENTS_PATH}`, open);
      ctx.net.route(`${ORIGIN}/api/board`, board);
    },
    save,
    emit: push,
    /** Ends every open stream, as a dropped connection does. */
    drop(): void {
      for (const c of [...streams]) {
        streams.delete(c);
        try {
          c.close();
        } catch {
          // already closed
        }
      }
    },
    opens: (): number => state.opens,
    openNow: (): number => streams.size,
    value: (): BoardValue => ({ head: state.head, items: [...state.items] }),
  };
}

export type Read = (ctx: SimCtx, signal?: AbortSignal) => Promise<Result<BoardValue, KeelError<string, unknown>>>;

/** A read the test resolves by hand; `calls()` counts its invocations, `at(i)` is the clock reading of call i. */
export function controlled() {
  const signals: (AbortSignal | undefined)[] = [];
  const pending: { at: number; done: (r: Result<BoardValue, KeelError<string, unknown>>) => void }[] = [];
  const read: Read = (c, signal) =>
    new Promise((done) => {
      signals.push(signal);
      pending.push({ at: c.clock.now(), done });
    });
  return {
    read,
    calls: (): number => pending.length,
    signal(i: number): AbortSignal {
      const s = signals[i];
      if (s === undefined) throw new Error(`read ${i} got no signal`);
      return s;
    },
    at(i: number): number {
      const p = pending[i];
      if (p === undefined) throw new Error(`no read ${i}`);
      return p.at;
    },
    resolve(i: number, r: Result<BoardValue, KeelError<string, unknown>>): void {
      const p = pending[i];
      if (p === undefined) throw new Error(`no read ${i}`);
      p.done(r);
    },
  };
}

/** A read that resolves at once with `value()` and counts its calls. */
export function counting(value: () => BoardValue) {
  let n = 0;
  const read: Read = async () => {
    n++;
    return ok(value());
  };
  return { read, calls: (): number => n };
}

export const boom = (): Result<BoardValue, KeelError<string, unknown>> =>
  err({ code: "board.boom", message: "boom", data: {} });

let counter = 0;

/**
 * Builds the client store and its hydrating transaction in one scope and calls `live` in another, so the store
 * outlives the live scope (`dispose()` disposes only the latter).
 */
export function mount(ctx: SimCtx, read: Read) {
  counter++;
  const made: { view?: ReturnType<typeof makeView> } = {};
  scope(
    () => {
      made.view = makeView(`view.${counter}`);
    },
    { detached: true },
  );
  const view = made.view;
  if (view === undefined) throw new Error("mount: store scope did not run");
  const got: { status?: ReturnType<typeof live> } = {};
  const sc = scope(
    () => {
      got.status = live(ctx, ORIGIN, boardChannel, {}, { read, hydrate: view.hydrate });
    },
    { detached: true },
  );
  const status = got.status;
  if (status === undefined) throw new Error("mount: live scope did not run");
  return { view: view.store, hydrate: view.hydrate, status, dispose: () => sc.dispose() };
}

function makeView(id: string) {
  const view = store(Board, EMPTY, { id });
  const hydrate = transaction(view, "board.hydrate", Board, (_st, p) => p);
  return { store: view, hydrate };
}

/** The `head` of each hydrated payload in a view's log, in commit order. */
export const tagsOf = (view: { log(): readonly { payload: unknown }[] }): number[] =>
  view.log().map((e) => {
    const h: unknown = typeof e.payload === "object" && e.payload !== null ? Reflect.get(e.payload, "head") : undefined;
    return typeof h === "number" ? h : -1;
  });

/** A `read` through the k.services client, as an app's loader or call would be. */
export const readBoard: Read = (ctx) => api.board({}, ctx);
