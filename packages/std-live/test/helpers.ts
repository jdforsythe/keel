// Shared by the std-live unit tests: a sim channel route the test drives by hand and a mount in its own scope.
import { type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { type KeelError, type Result, s } from "@keel/schema";
import { channel } from "@keel/std-channels";
import { store, transaction } from "@keel/store";
import { live } from "../src/index.ts";

export const ORIGIN = "https://app.example.com";
const ch = channel("unit.board", { path: "/events", params: s.object({}) });
const enc = new TextEncoder();

export const settle = async (): Promise<void> => {
  for (let i = 0; i < 300; i++) await Promise.resolve();
};

/**
 * A sim ctx whose `/events` stream sends `reset` on open; `emit` pushes an event to every open stream and `drop` ends
 * every open stream as a lost connection does.
 */
export function server(seed = 1337) {
  const ctx: SimCtx = createCtx({ mode: "sim", seed });
  const open = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const emit = (event: unknown): void => {
    for (const c of open) c.enqueue(enc.encode(`data: ${JSON.stringify({ ok: true, value: event })}\n\n`));
  };
  const drop = (): void => {
    for (const c of open) c.error(new TypeError("connection lost"));
    open.clear();
  };
  ctx.net.route(`${ORIGIN}/events`, () => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        open.add(c);
        c.enqueue(enc.encode(`data: ${JSON.stringify({ ok: true, value: { kind: "reset" } })}\n\n`));
      },
    });
    return new Response(body, { headers: { "content-type": "text/event-stream" } });
  });
  return { ctx, emit, drop };
}

let n = 0;

/** A view store and `live` over it, each in its own scope; `dispose` ends the live scope. */
export function mount(
  ctx: SimCtx,
  read: (ctx: SimCtx, signal: AbortSignal) => Promise<Result<number, KeelError<string, unknown>>>,
) {
  const made: { view?: ReturnType<typeof makeView> } = {};
  scope(() => {
    made.view = makeView(`unit.view${++n}`);
  });
  const view = made.view;
  if (view === undefined) throw new Error("no view");
  const got: { status?: () => string } = {};
  const sc = scope(() => {
    got.status = live(ctx, ORIGIN, ch, {}, { read, hydrate: view.hydrate });
  });
  return { view: view.store, status: () => got.status?.() ?? "", dispose: () => sc.dispose() };
}

function makeView(id: string) {
  const view = store(s.object({ n: s.int() }), { n: 0 }, { id });
  const hydrate = transaction(view, "view.hydrate", s.int(), (_st, p) => ({ n: p }));
  return { store: view, hydrate };
}
