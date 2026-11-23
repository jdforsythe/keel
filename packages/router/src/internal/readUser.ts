import type { Ctx } from "@keel/ctx";
import { absoluteUrl } from "./absoluteUrl.ts";

/** The longest `user` k.user lets an identity source answer. */
const MAX = 256;

/**
 * One read of the page origin's `/__keel/user` through `ctx.net` (k.guards Client): a GET with `x-keel: 1`. Its
 * `user` when the answer is 200 with a JSON body `{ user }` of a string of at most 256 characters; `''` for any other
 * answer and when the fetch fails. Nothing of it is kept, logged or written.
 */
export async function readUser(ctx: Ctx): Promise<string> {
  try {
    const res = await ctx.net.fetch(
      new Request(absoluteUrl("/__keel/user"), { headers: { "x-keel": "1", accept: "application/json" } }),
    );
    if (res.status !== 200) {
      void res.body?.cancel().catch(() => undefined);
      return "";
    }
    const body: unknown = await res.json();
    const user: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "user") : undefined;
    return typeof user === "string" && user.length <= MAX ? user : "";
  } catch {
    return "";
  }
}
