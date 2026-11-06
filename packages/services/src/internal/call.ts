import type { Ctx } from "@keel/ctx";
import { type Result, err } from "@keel/schema";
import type { ApiError } from "../ApiError.ts";
import type { Endpoint } from "../Endpoint.ts";
import { buildRequest } from "./buildRequest.ts";
import { deadline } from "./deadline.ts";
import { exchange } from "./exchange.ts";
import { fail } from "./fail.ts";

/**
 * One client call. The timeout starts now on `ctx.clock`; when it is reached first the request signal is
 * aborted and the result is `api.timeout`. A late response is ignored.
 */
export async function call(
  e: Endpoint,
  base: string,
  ms: number,
  input: unknown,
  ctx: Ctx,
): Promise<Result<unknown, ApiError>> {
  const timer = deadline(ctx.clock, ms);
  const controller = new AbortController();
  const req = buildRequest(e, base, input, controller.signal);
  if (!req.ok) {
    timer.cancel();
    return req;
  }
  const timedOut = timer.done.then(() => {
    controller.abort();
    return err(fail.timeout(ms));
  });
  const r = await Promise.race([exchange(e, req.value, ctx), timedOut]);
  timer.cancel();
  return r;
}
