import type { Ctx } from "@keel/ctx";
import { type Result, attempt, err, ok } from "@keel/schema";
import type { ApiError } from "../ApiError.ts";
import type { Endpoint } from "../Endpoint.ts";
import type { Target } from "./Target.ts";
import { buildRequest } from "./buildRequest.ts";
import { decodeEvent } from "./decodeEvent.ts";
import { exchange } from "./exchange.ts";
import { fail } from "./fail.ts";
import { linkSignal } from "./linkSignal.ts";
import { sseData } from "./sseData.ts";

/**
 * Read an `events: true` endpoint (k.services): one request with `accept: text/event-stream`; `ms` bounds the wait for
 * the response to start (`api.timeout`). A non-2xx answer is decoded as by a plain call (at most `limit` bytes) and ends it; then each event is
 * yielded (`decodeEvent`) until the stream ends, an `err` or a decode failure (yielded, then the end), the body errors
 * (`api.network`) or the input's `signal` aborts (no further result). It never reconnects; leaving it early aborts the request.
 */
export async function* events(
  e: Endpoint,
  target: Target,
  ms: number,
  limit: number,
  input: unknown,
  ctx: Ctx,
): AsyncGenerator<Result<unknown, ApiError>> {
  const controller = new AbortController();
  linkSignal(input, controller);
  const req = buildRequest(
    e,
    target.base,
    input,
    controller.signal,
    "text/event-stream",
    target.sign,
    target.user,
    target.keel,
  );
  if (!req.ok) {
    yield req;
    return;
  }
  const cancel = new AbortController();
  const timer = ctx.clock.after(ms, cancel.signal).then(
    () => {
      controller.abort();
      return err(fail.timeout(ms));
    },
    () => new Promise<never>(() => {}),
  );
  const sent = attempt(() => target.send(req.value)).then((r) => (r.ok ? ok(r.value) : err(fail.network())));
  const started = await Promise.race([sent, timer]);
  cancel.abort();
  try {
    if (!started.ok) {
      if (!controller.signal.aborted || started.error.code === "api.timeout") yield started;
      return;
    }
    const res = started.value;
    if (res.status < 200 || res.status >= 300) {
      yield await exchange(e, req.value, { ...target, send: async () => res }, limit);
      return;
    }
    if (res.body === null) return;
    const body = res.body;
    let failed = false;
    try {
      for await (const data of sseData(body, controller.signal)) {
        const r = decodeEvent(e, data);
        if (controller.signal.aborted) return;
        yield r;
        if (!r.ok) return;
      }
    } catch {
      failed = !controller.signal.aborted;
    }
    if (failed) yield err(fail.network());
  } finally {
    controller.abort();
  }
}
