import { scope } from "@keel/reactive";
import type { Loader } from "@keel/router";
import type { Match } from "@keel/router/internal";
import { fixedUser, judgedUser, publicError } from "@keel/router/internal";
import { type KeelError, type Result, err, ok } from "@keel/schema";
import { isolate } from "@keel/store";
import type { Context } from "hono";
import { type SSEStreamingApi, streamSSE } from "hono/streaming";
import type { Handled } from "./Handled.ts";
import { MAX_EVENT_BYTES } from "./MAX_EVENT_BYTES.ts";
import type { Req } from "./Req.ts";
import type { RequestScope } from "./RequestScope.ts";
import { attempted } from "./attempted.ts";
import { busy } from "./busy.ts";
import { caught } from "./caught.ts";
import { diagLine } from "./diagLine.ts";
import { identified } from "./identified.ts";
import { openFactory } from "./openFactory.ts";
import { scrubbedCause } from "./scrubbedCause.ts";
import { scrubbedDiag } from "./scrubbedDiag.ts";
import { unexpectedOf } from "./unexpectedOf.ts";

const HEARTBEAT_MS = 15_000;
/** The bytes an event adds around its JSON: `data: ` and two line feeds. */
const FRAME_BYTES = 8;

/**
 * The event stream of a live loader (k.server Request flow), after its guards passed, with the request's `caller`, the `user`
 * it opened with (k.user) and `bearer` (k.api Bearer): its `stores` factory opens
 * once and nothing saves; each yield is one `data:` line, its `Result` JSON (`ok` encoded by `output`, `err` as it may
 * leave the server, an `output` encode that throws its `keel.unexpected` scrubbed by `scrubbedCause`); a `:` line goes out per 15 s of `ctx.clock`. It ends when `fn` returns or its `signal` aborts:
 * on request abort or `close()` (both also cancel the stream, so a stalled write ends), or when the reader cancels.
 * The factory opens in the stream's own isolated scope, not the request's (disposed when `handle` returns), and that
 * scope is disposed when the stream ends. A throw of `fn` ends it with one `data:` line, its `keel.unexpected` `err`, and a
 * `keel.unexpected` diag written to `log`, both without the request's `.pii()` values and revealed secrets (`scrubbedCause`, `scrubbedDiag`; past a scrub cap the diag keeps `loader <id> threw: `). An event over 1,048,576 bytes as written (`data: `, the JSON, two line feeds) is not
 * written: the stream writes that same `err` line, logs one `keel.unexpected` diag `loader <id> event over 1048576 bytes`, ends, and returns `fn`'s iterator. Written with Hono's `streamSSE`; `cache-control: no-store`. With
 * `maxStreams` streams open it is 503 `keel.busy` and opens nothing; a stream holds its place until it ends.
 * `fn`'s args have `currentUser()` (k.user): `identify` run again on the opening request without its body
 * (`identified`), `""` for a throw, an invalid answer or no answer in 5,000 ms; with no identity source `""`, and for
 * a stream whose `user` a verified `x-keel-user` gave (`asserted`), that `user`, with no `identify` run.
 */
export function liveStream(r: Req, m: Match & { kind: "route" }, live: Loader, c: Context, asserted: boolean): Handled {
  const { sv, raw } = r;
  if (sv.streams.open >= sv.maxStreams) return { response: busy(sv.maxStreams), route: m.route.id, diags: [] };
  const rq: RequestScope = { ...r.rq, scope: scope(() => undefined, { detached: true }), held: new Map() };
  isolate(rq.scope);
  const ac = new AbortController();
  const stop = (): void => ac.abort();
  const ended = new Promise<undefined>((resolve) => ac.signal.addEventListener("abort", () => resolve(undefined)));
  const opener = r.rq.caller.set === "" ? r.rq.caller.id : "";
  // With nothing to ask, the answer is the stream's own `user`, `fixed`: no `identify`, no bound on the clock, and a
  // caller that reads `fixed` runs no check at all.
  const currentUser =
    asserted || sv.identity === undefined
      ? fixedUser(rq.user)
      : judgedUser(() => identified(sv, raw, opener).then((answer) => (answer.kind === "user" ? answer.user : "")));
  sv.streams.open++;
  const run = async (stream: SSEStreamingApi): Promise<void> => {
    const halt = (): void => {
      stop();
      stream.abort();
    };
    let beat: Promise<void> | undefined;
    let tooBig = false;
    let it: AsyncIterator<Result<unknown, KeelError<string, unknown>>> | undefined;
    try {
      raw.signal.addEventListener("abort", halt, { once: true });
      sv.lifecycle.signal.addEventListener("abort", halt, { once: true });
      stream.onAbort(stop);
      if (raw.signal.aborted) halt();
      beat = (async () => {
        while ((await attempted(() => sv.ctx.clock.after(HEARTBEAT_MS, ac.signal))).ok) await stream.write(":\n\n");
      })();
      const ran = await caught(async () => {
        const stores = live.stores === undefined ? undefined : await openFactory(sv.ctx, rq, live.stores);
        const args = {
          params: m.params,
          search: m.search,
          url: r.url,
          caller: rq.caller.id,
          user: rq.user,
          stores,
          signal: ac.signal,
          currentUser,
        };
        it = live
          .live?.(rq.bearer === undefined ? args : { ...args, bearer: rq.bearer }, sv.ctx)
          [Symbol.asyncIterator]();
        while (it !== undefined) {
          const next = await Promise.race([it.next(), ended]);
          if (next === undefined || next.done === true) break;
          const res = next.value;
          const json = res.ok
            ? attempted(() => ok(live.output.encode(res.value)))
            : ok(err(publicError(res.error, sv.mode)));
          const data = JSON.stringify(json.ok ? json.value : err(publicError(scrubbedCause(json.error, rq), sv.mode)));
          if (Buffer.byteLength(data) + FRAME_BYTES > MAX_EVENT_BYTES) {
            tooBig = true;
            break;
          }
          await stream.writeSSE({ data });
        }
      }, sv.frames);
      // A throw, or an event over the cap, is one scrubbed `keel.unexpected` diag in the log and a last `data:` line
      // holding its `err`.
      const cause = ran.result.ok ? undefined : ran.result.error;
      const over = `event over ${MAX_EVENT_BYTES} bytes`;
      const failure = cause ?? (tooBig ? unexpectedOf(over) : undefined);
      if (failure !== undefined) {
        const clean = scrubbedCause(failure, rq);
        const lead = cause === undefined ? `loader ${m.route.id} ` : `loader ${m.route.id} threw: `;
        const d = { code: "keel.unexpected", lead, message: lead + clean.data.cause, frames: ran.frames };
        sv.log?.write(diagLine(sv.log.format, scrubbedDiag(d, rq)));
        await attempted(() => stream.writeSSE({ data: JSON.stringify(err(publicError(clean, sv.mode))) }));
      }
    } finally {
      sv.streams.open--;
      stop();
      raw.signal.removeEventListener("abort", halt);
      sv.lifecycle.signal.removeEventListener("abort", halt);
      void attempted(() => it?.return?.());
      await beat;
      rq.scope.dispose();
    }
  };
  // `run` never throws: Hono's stream would write a thrown value's message to the stream or print it to stderr.
  const response = streamSSE(c, async (stream) => {
    await attempted(() => run(stream));
  });
  response.headers.set("cache-control", "no-store");
  return { response, route: m.route.id, diags: [] };
}
