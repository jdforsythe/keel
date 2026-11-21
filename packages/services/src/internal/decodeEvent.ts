import { type Result, err, ok } from "@keel/schema";
import type { ApiError } from "../ApiError.ts";
import type { Endpoint } from "../Endpoint.ts";
import { fail } from "./fail.ts";
import { readJson } from "./readJson.ts";

/**
 * One event of an `events` endpoint: a k.server `Result` in JSON. An `ok` value is decoded with `output` (failing:
 * `api.decode`); an `err` is `api.status` with status 200 and the error as `body`; anything else is `api.decode`.
 */
export function decodeEvent(e: Endpoint, data: string): Result<unknown, ApiError> {
  const json = readJson(data);
  const r: unknown = json.ok ? json.value : undefined;
  if (typeof r === "object" && r !== null && Reflect.get(r, "ok") === true) {
    const decoded = e.output.parse(Reflect.get(r, "value"));
    return decoded.ok ? ok(decoded.value) : err(fail.decode(decoded.error.data.issues));
  }
  if (typeof r === "object" && r !== null && Reflect.get(r, "ok") === false)
    return err(fail.status<unknown>(200, Reflect.get(r, "error")));
  return err(fail.decode([{ path: [], rule: "type" }]));
}
