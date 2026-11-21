import { type Result, attempt, err, ok } from "@keel/schema";
import type { ApiError } from "../ApiError.ts";
import type { Endpoint } from "../Endpoint.ts";
import type { Target } from "./Target.ts";
import { fail } from "./fail.ts";
import { isUnreachable } from "./isUnreachable.ts";
import { readJson } from "./readJson.ts";
import { readWithin } from "./readWithin.ts";
import { routeResult } from "./routeResult.ts";

/**
 * Send `req` to `target` (`ctx.net.fetch`, or an app in process) and decode the response: 2xx by `output` (`api.decode` on failure), a declared
 * status by `errors[status]` (body null when it does not decode), any other status `api.status` with body null.
 * On a `module` target the body is the k.server answer and its route's `Result` (`routeResult`) is decoded: on a 2xx
 * its `ok` value by `output` (no `ok` `Result`: `api.decode`), on a non-2xx its `err`'s error by `errors[status]`; a
 * 502 whose JSON body (at most 1 KiB) is a `keel.unreachable` err is `api.network`, ahead of any declared 502. At most
 * `limit` bytes of a body are read: a longer one is `api.decode` on a 2xx, `api.status` with body null otherwise.
 */
export async function exchange(
  e: Endpoint,
  req: Request,
  target: Target,
  limit: number,
): Promise<Result<unknown, ApiError>> {
  const fetched = await attempt(() => target.send(req));
  if (!fetched.ok) return err(fail.network());
  const res = fetched.value;
  const success = res.status >= 200 && res.status < 300;
  if (res.status === 502 && target.module === true && (await isUnreachable(res))) return err(fail.network());
  const schema = success ? e.output : e.errors?.[res.status];
  if (schema === undefined) return err(fail.status(res.status, null));
  const text = await readWithin(res, limit);
  if (!text.ok && text.error === "failed") return err(fail.network());
  if (!text.ok) return err(success ? fail.decode([{ path: [], rule: "max" }]) : fail.status(res.status, null));
  const json = readJson(text.value);
  const body = !json.ok
    ? undefined
    : target.module === true
      ? routeResult(json.value, req.method === "GET")
      : success
        ? json
        : err(json.value);
  const decoded = body?.ok === success ? schema.parse(body.ok ? body.value : body.error) : undefined;
  if (!success) return err(fail.status(res.status, decoded?.ok ? decoded.value : null));
  if (decoded === undefined) return err(fail.decode([{ path: [], rule: "type" }]));
  return decoded.ok ? ok(decoded.value) : err(fail.decode(decoded.error.data.issues));
}
