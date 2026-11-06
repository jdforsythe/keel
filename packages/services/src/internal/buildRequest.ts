import { type Result, attempt, err, ok } from "@keel/schema";
import type { ApiError } from "../ApiError.ts";
import type { Endpoint } from "../Endpoint.ts";
import { encodePart } from "./encodePart.ts";
import { encodeQuery } from "./encodeQuery.ts";
import { fail } from "./fail.ts";
import { fillPath } from "./fillPath.ts";

/**
 * Build the Request for one call: path params URL-encoded, query by its schema, body as JSON. Invalid input is
 * `api.decode`; a Request the platform refuses (bad URL, body on GET) is `api.network`.
 */
export function buildRequest(
  e: Endpoint,
  base: string,
  input: unknown,
  signal: AbortSignal,
): Result<Request, ApiError<never>> {
  const params = encodePart(e.params, "params", input);
  if (!params.ok) return params;
  const query = encodePart(e.query, "query", input);
  if (!query.ok) return query;
  const body = encodePart(e.body, "body", input);
  if (!body.ok) return body;
  const path = fillPath(e.path, params.value);
  if (!path.ok) return path;
  const qs = query.value === undefined ? "" : encodeQuery(query.value).toString();
  const url = `${base.replace(/\/+$/, "")}${path.value}${qs === "" ? "" : `?${qs}`}`;
  const json = body.value;
  const init: RequestInit =
    json === undefined
      ? { method: e.method, headers: { accept: "application/json" }, signal }
      : {
          method: e.method,
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify(json),
          signal,
        };
  const req = attempt(() => new Request(url, init));
  return req.ok ? ok(req.value) : err(fail.network());
}
