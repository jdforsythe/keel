import type { Ctx } from "@keel/ctx";
import { type Result, err } from "@keel/schema";
import type { ApiError } from "../ApiError.ts";
import type { Endpoint } from "../Endpoint.ts";
import { buildRequest } from "./buildRequest.ts";
import { exchange } from "./exchange.ts";
import { fail } from "./fail.ts";

/**
 * One client call. The timeout is `ctx.clock.after(ms, ...)`; when it is reached first the request signal is
 * aborted and the result is `api.timeout`. A late response is ignored.
 */
export async function call(
  e: Endpoint,
  base: string,
  ms: number,
  input: unknown,
  ctx: Ctx,
): Promise<Result<unknown, ApiError>> {
  const cancel = new AbortController();
  const timer = ctx.clock.after(ms, cancel.signal);
  const controller = new AbortController();
  const req = buildRequest(e, base, input, controller.signal);
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
  const r = await Promise.race([exchange(e, req.value, ctx), timedOut]);
  cancel.abort();
  return r;
}
