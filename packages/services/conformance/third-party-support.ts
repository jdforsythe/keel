// Shared fixture for the RFC 0197 k.services clauses 13 to 16 (not a test file). Seed for every property: 1337. No wall clock, no Math.random.
// ASSUMPTION: sim net is `ctx.net.route(pattern, handler)`, the handler receives the outgoing `Request` and answers a standard `Response`.
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import type { Secret } from "@keel/schema";
import { endpoints, service } from "@keel/services";

export const SEED = 1337;
export const THIRD = "https://api.example.com";
export const Item = s.string().nullable();

export const schema = endpoints({
  show: { method: "GET", path: "/items/:id", params: s.object({ id: s.string() }), output: Item },
  save: {
    method: "POST",
    path: "/items/:id",
    params: s.object({ id: s.string() }),
    body: s.object({ note: s.string() }),
    output: Item,
  },
  watch: { method: "GET", path: "/watch", output: Item, events: true },
});
export const client = (base: string = THIRD) => service({ base, schema });

/** What a request carried: the header names (sorted), their values, the method, `credentials` and `redirect`. */
export interface Seen {
  readonly names: readonly string[];
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
  readonly credentials: string;
  readonly redirect: string;
  readonly url: string;
}
export function seen(req: Request): Seen {
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headers[k] = v;
  });
  return {
    names: Object.keys(headers).sort(),
    headers,
    method: req.method,
    credentials: req.credentials,
    redirect: req.redirect,
    url: req.url,
  };
}

export const secret = (text: string): Secret<string> => {
  const parsed = s.secret(s.string()).parse(text);
  if (!parsed.ok) throw new Error("fixture: a string parses as a secret");
  return parsed.value;
};

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const enc = new TextEncoder();
export const eventStream = (): Response =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode(`data: ${JSON.stringify({ ok: true, value: "v" })}\n\n`));
        c.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
/** Answers each request by shape: the event stream for `/watch`, else the JSON `null`. */
export const answer = (req: Request): Response => (new URL(req.url).pathname === "/watch" ? eventStream() : json(null));

/** Records every request the ctx's net carries; `reply` answers. */
export function record(ctx: SimCtx, reply: (req: Request) => Response = answer, pattern = "*"): Seen[] {
  const sent: Seen[] = [];
  ctx.net.route(pattern, (req) => {
    sent.push(seen(req));
    return reply(req);
  });
  return sent;
}
export const simCtx = (seed = SEED): SimCtx => createCtx({ mode: "sim", seed });

/** The request headers a CORS preflight is not needed for (Fetch: CORS-safelisted names). */
export const SAFELISTED = ["accept", "accept-language", "content-language", "content-type", "range"] as const;

export async function drain(it: AsyncIterable<unknown>): Promise<void> {
  for await (const _ of it) void _;
}
