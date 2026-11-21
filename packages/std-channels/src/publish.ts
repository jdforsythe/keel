import type { Ctx } from "@keel/ctx";
import { type Result, ok } from "@keel/schema";
import type { ApiError } from "@keel/services";
import type { Channel } from "./Channel.type.ts";
import { apiOf } from "./internal/apiOf.ts";

/**
 * Publish `message` to the members of `channel` with `params` at `origin` (std.channels Client): a POST through
 * `@keel/services` to the channel's path, `ok(null)` once the serving process delivered it. Never throws: a
 * non-member gets `api.status` 403, an invalid `message` `api.input`, and the k.services errors and timeout apply.
 */
export async function publish<P, M>(
  ctx: Ctx,
  origin: string,
  channel: Channel<P, M>,
  params: P,
  message: M,
): Promise<Result<null, ApiError>> {
  const r = await apiOf(origin, channel).publish({ query: params, body: { message } }, ctx);
  return r.ok ? ok(null) : r;
}
