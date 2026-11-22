import { publicError } from "@keel/router/internal";
import { err } from "@keel/schema";
import type { Handled } from "./Handled.ts";
import type { Req } from "./Req.ts";
import { denied } from "./denied.ts";
import { jsonResponse } from "./jsonResponse.ts";
import { statusOf } from "./statusOf.ts";
import { userOf } from "./userOf.ts";

/**
 * `GET /__keel/user` on a deployable with an identity source (k.guards Client): without `x-keel: 1`, 403 `keel.denied`
 * and `identify` is not asked; else `{ user }`, `userOf`'s answer, or its error as k.user answers it (500, 503). Every
 * answer is `cache-control: no-store`. Another method is 405 with `allow: GET`.
 */
export async function userEntry(r: Req): Promise<Handled> {
  if (r.method !== "GET")
    return { response: new Response(null, { status: 405, headers: { allow: "GET" } }), route: undefined, diags: [] };
  if (r.raw.headers.get("x-keel") !== "1")
    return { response: denied("x-keel header required"), route: undefined, diags: [] };
  const who = await userOf(r);
  if (typeof who === "string") r.rq.user = who;
  const response =
    typeof who === "string"
      ? jsonResponse(200, { user: who })
      : jsonResponse(statusOf(who.code), err(publicError(who, r.sv.mode)));
  response.headers.set("cache-control", "no-store");
  return { response, route: undefined, diags: [] };
}
