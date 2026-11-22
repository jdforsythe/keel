import type { Ctx } from "@keel/ctx";
import { type Result, err } from "@keel/schema";
import type { ApiError } from "../ApiError.ts";
import type { Endpoint } from "../Endpoint.ts";
import type { Target } from "./Target.ts";
import { buildRequest } from "./buildRequest.ts";
import { exchange } from "./exchange.ts";
import { fail } from "./fail.ts";
import { linkSignal } from "./linkSignal.ts";

/**
 * One client call to `target`. The timeout is `ctx.clock.after(ms, ...)`; when it is reached first the request signal
 * is aborted and the result is `api.timeout`. A late response is ignored. The input's `signal` aborts the request.
 * At most `limit` bytes of the response body are read (`exchange`).
 */
export async function call(
  e: Endpoint,
  target: Target,
  ms: number,
  limit: number,
  input: unknown,
  ctx: Ctx,
): Promise<Result<unknown, ApiError>> {
  const cancel = new AbortController();
  const timer = ctx.clock.after(ms, cancel.signal);
  const controller = new AbortController();
  linkSignal(input, controller);
  const req = buildRequest(e, target.base, input, controller.signal, undefined, target.sign, target.user);
  if (!req.ok) {
    cancel.abort();
    timer.catch(() => undefined);
    return req;
  }
  // A cancelled timer rejects; the race is already settled, so that branch stays pending.
  const timedOut = timer.then(
    () => {
      controller.abort();
      return err(fail.timeout(ms));
    },
    () => new Promise<never>(() => {}),
  );
  const r = await Promise.race([exchange(e, req.value, target, limit), timedOut]);
  cancel.abort();
  return r;
}
