import { type Result, attempt, err, ok } from "@keel/schema";
import type { ApiError } from "../ApiError.ts";
import type { Endpoint } from "../Endpoint.ts";
import type { Target } from "./Target.ts";
import { fail } from "./fail.ts";
import { readJson } from "./readJson.ts";

/**
 * Send `req` to `target` (`ctx.net.fetch`, or an app in process) and decode the response: 2xx by `output` (`api.decode` on failure), a declared
 * status by `errors[status]` (body null when it does not decode), any other status `api.status` with body null.
 */
export async function exchange(e: Endpoint, req: Request, target: Target): Promise<Result<unknown, ApiError>> {
  const fetched = await attempt(() => target.send(req));
  if (!fetched.ok) return err(fail.network());
  const res = fetched.value;
  const success = res.status >= 200 && res.status < 300;
  const schema = success ? e.output : e.errors?.[res.status];
  if (schema === undefined) return err(fail.status(res.status, null));
  const text = await attempt(() => res.text());
  if (!text.ok) return err(fail.network());
  const json = readJson(text.value);
  const decoded = json.ok ? schema.parse(json.value) : undefined;
  if (!success) return err(fail.status(res.status, decoded?.ok ? decoded.value : null));
  if (decoded === undefined) return err(fail.decode([{ path: [], rule: "type" }]));
  return decoded.ok ? ok(decoded.value) : err(fail.decode(decoded.error.data.issues));
}
