import { type Result, attempt, err, ok, reveal, s } from "@keel/schema";
import type { ApiError } from "../ApiError.ts";
import type { Endpoint } from "../Endpoint.ts";
import type { Target } from "./Target.ts";
import { encodePart } from "./encodePart.ts";
import { encodeQuery } from "./encodeQuery.ts";
import { fail } from "./fail.ts";
import { fillPath } from "./fillPath.ts";

const Bearer = s.secret(s.string());

/**
 * Build the Request for one call: path params URL-encoded, query by its schema, body as JSON, with
 * `accept` (`application/json`; `text/event-stream` for an `events` endpoint), `x-keel: 1` (the k.server same-site proof for writes)
 * only when `keel` (the target is a Keel origin, k.services Encoding) and, with a `bearer`, `authorization: Bearer <token>`, revealed here and nowhere else. Invalid input is `api.input` and nothing is
 * built: a `bearer` that is not a secret whose text is a token68 of 1 to 4,096 characters (k.api Bearer) is `format` at
 * `bearer`. A `user` is sent as `x-keel-user`, signed by the target's `sign` over the body as sent (k.user); a `user`
 * that is not a string, or one on a target with no `sign` (a ctx no `createApp` bound), is `api.input` `type` at `user`,
 * and one the signer refuses (over 256 characters) `max`. An input that names no `user` carries `fallback` (k.user Testing). A Request the platform refuses (bad URL, body on GET) is `api.network`.
 */
export function buildRequest(
  e: Endpoint,
  base: string,
  input: unknown,
  signal: AbortSignal,
  accept = "application/json",
  sign?: Target["sign"],
  fallback?: string,
  keel = true,
): Result<Request, ApiError<never>> {
  const params = encodePart(e.params, "params", input);
  if (!params.ok) return params;
  const query = encodePart(e.query, "query", input);
  if (!query.ok) return query;
  const body = encodePart(e.body, "body", input);
  if (!body.ok) return body;
  const b: unknown = Reflect.get(Object(input), "bearer");
  const sb = typeof b === "string" ? undefined : Bearer.parse(b);
  const token = sb?.ok ? reveal(sb.value) : "";
  if (b !== undefined && !/^[\w.~+/-]{1,4096}=*$/.test(token))
    return err(fail.input([{ path: ["bearer"], rule: "format" }]));
  const path = fillPath(e.path, params.value);
  if (!path.ok) return path;
  const qs = query.value === undefined ? "" : encodeQuery(query.value).toString();
  // The URL as the Request will hold it, so the `x-keel-user` signature covers the URL sent.
  const parsed = attempt(() => new URL(`${base.replace(/\/+$/, "")}${path.value}${qs === "" ? "" : `?${qs}`}`).href);
  if (!parsed.ok) return err(fail.network());
  const url = parsed.value;
  const json = body.value;
  // The body is JSON text, held whole before sending, so a signed `user` covers every byte sent; no stream is built.
  const text = json === undefined ? "" : JSON.stringify(json);
  const named: unknown = Reflect.get(Object(input), "user");
  const user = named === undefined ? fallback : named;
  const signed = typeof user === "string" ? sign?.(e.method, url, user, text) : undefined;
  if (user !== undefined && signed === undefined)
    return err(fail.input([{ path: ["user"], rule: typeof user === "string" && sign !== undefined ? "max" : "type" }]));
  const headers: Record<string, string> = keel ? { accept, "x-keel": "1" } : { accept };
  if (b !== undefined) headers.authorization = `Bearer ${token}`;
  if (signed !== undefined) headers["x-keel-user"] = signed;
  const init: RequestInit =
    json === undefined
      ? { method: e.method, headers, signal }
      : {
          method: e.method,
          headers: { ...headers, "content-type": "application/json" },
          body: text,
          signal,
        };
  const req = attempt(() => new Request(url, init));
  return req.ok ? ok(req.value) : err(fail.network());
}
