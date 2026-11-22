import type { KeelError } from "@keel/schema";
import type { Req } from "./Req.ts";
import type { RequestUser } from "./RequestUser.ts";
import { identified } from "./identified.ts";
import { readCapped } from "./readCapped.ts";
import { unexpected } from "./unexpected.ts";

/** The user a request's `x-keel-user` asserts; a body over `maxBody` asserts none. */
async function assertedOf({ sv, raw }: Req): Promise<string | undefined> {
  const body = raw.body === null ? new Uint8Array(0) : await readCapped(raw.clone(), sv.maxBody);
  return body === null ? undefined : sv.keys.user(raw, sv.ctx.clock.now(), body);
}

/**
 * The `user` of a routed request (k.user), asked before its guards: the user an `x-keel-user` another deployable of
 * the app signed for this request's body and this deployable asserts (`keys.user`; the body is read from a copy, capped
 * at `maxBody`, so the route reads it again), else `identify`'s answer to the request without its body and the caller it
 * presented (`""` when this request minted one; `identified`), else `""` with no identity source. Nothing is kept
 * between requests. A throw or an invalid answer is `keel.unexpected` with its `diag`; past 5,000 ms on `ctx.clock`,
 * `keel.busy` with `data: { limit: 5000 }`. The error fails the request as a guard's would (`runGuards`).
 */
export async function userOf(r: Req): Promise<RequestUser | KeelError<string, unknown>> {
  const { sv, rq, raw } = r;
  const asserted = raw.headers.has("x-keel-user") ? await assertedOf(r) : undefined;
  if (asserted !== undefined) return { user: asserted, asserted: true };
  const answer = await identified(sv, raw, rq.caller.set === "" ? rq.caller.id : "");
  if (answer.kind === "user") return { user: answer.user, asserted: false };
  if (answer.kind === "busy")
    return { code: "keel.busy", message: `identify took over ${answer.limit} ms`, data: { limit: answer.limit } };
  return unexpected(`identify ${answer.bad}`);
}
