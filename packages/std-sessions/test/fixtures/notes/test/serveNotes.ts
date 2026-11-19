import type { SimCtx } from "@keel/ctx";

/** What a notes server saw: the caller of each write, and each feed stream a client cancelled. */
export type NotesLog = { readonly writes: string[]; readonly cancelled: string[] };

const COOKIE = /(?:^|;\s*)keel-caller=([^;]+)/;

/**
 * A notes server over a sim ctx, with the caller cookie as `createApp` sets it (`HttpOnly; SameSite=Lax; Path=/`, on
 * the response's headers after it is built): `POST /api/notes` answers the caller as text; `GET /api/feed` sends
 * three chunks and stays open until its reader cancels it. Every request is logged in `log`.
 */
export const serveNotes =
  (log: NotesLog) =>
  (ctx: SimCtx): { fetch(req: Request): Promise<Response> } => ({
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);
      const sent = COOKIE.exec(req.headers.get("cookie") ?? "")?.[1];
      const caller = sent ?? ctx.random.id("Caller");
      let res: Response;
      if (req.method === "POST" && url.pathname === "/api/notes") {
        log.writes.push(caller);
        res = new Response(caller, { status: 200 });
      } else if (url.pathname === "/api/feed") {
        const body = new ReadableStream<Uint8Array>({
          start(c) {
            for (const n of [1, 2, 3]) c.enqueue(new TextEncoder().encode(`chunk-${n}`));
          },
          cancel() {
            log.cancelled.push(url.pathname);
          },
        });
        res = new Response(body, { status: 200 });
      } else res = new Response("", { status: 404 });
      if (sent === undefined && req.method === "POST")
        res.headers.set("set-cookie", `keel-caller=${caller}; Path=/; HttpOnly; SameSite=Lax`);
      return res;
    },
  });
