// Shared fixtures for the rfc:0192 std.live conformance file (not a test file). Seed 1337.
// Assumption: std-live holds no dependency on std-channels' server half or on a data capability, so "a sim server whose route follows a database" is modelled by a sim net server whose write route records the row and then, as a followed commit does, sends `{ kind: 'changed' }` (never `saved`) on each open stream; each open stream starts with `reset`.
import type { SimCtx } from "@keel/ctx";
import { EVENTS_PATH, ORIGIN } from "./fixtures.ts";

type Controller = ReadableStreamDefaultController<Uint8Array>;
const enc = new TextEncoder();
const frame = (event: unknown): Uint8Array => enc.encode(`data: ${JSON.stringify({ ok: true, value: event })}\n\n`);
const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

export function createFollowingServer() {
  const streams = new Set<Controller>();
  const state: { items: string[] } = { items: [] };
  const open = (req: Request): Response => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        streams.add(c);
        c.enqueue(frame({ kind: "reset" }));
        req.signal.addEventListener("abort", () => {
          streams.delete(c);
          try {
            c.close();
          } catch {
            // already closed
          }
        });
      },
      cancel() {},
    });
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  const changed = (): void => {
    for (const c of [...streams]) {
      try {
        c.enqueue(frame({ kind: "changed" }));
      } catch {
        streams.delete(c);
      }
    }
  };
  const board = async (req: Request): Promise<Response> => {
    if (req.method === "GET") return json({ head: state.items.length, items: [...state.items] });
    const body: unknown = await req.json();
    const item: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "item") : undefined;
    if (typeof item !== "string") return new Response("{}", { status: 422 });
    state.items.push(item);
    changed();
    return json({ head: state.items.length });
  };
  return {
    attach(ctx: SimCtx): void {
      ctx.net.route(`${ORIGIN}${EVENTS_PATH}`, open);
      ctx.net.route(`${ORIGIN}/api/board`, board);
    },
    openNow: (): number => streams.size,
    items: (): string[] => [...state.items],
  };
}
