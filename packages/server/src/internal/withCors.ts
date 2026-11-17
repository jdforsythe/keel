/**
 * `res` granted to the allowed `origin` on an API route (k.hosting Allowed origins): a copy carrying
 * `access-control-allow-origin` (that origin), `access-control-allow-credentials: true` and `vary: origin` (appended);
 * without an `origin` (`undefined` or `""`), `vary: origin` alone; for a
 * preflight (`methods`, the route's) also `access-control-allow-methods`, `access-control-allow-headers: accept,
 * authorization, content-type, x-keel` and `access-control-max-age: 600`.
 */
export function withCors(res: Response, origin?: string, methods?: string): Response {
  const out = new Response(res.body, res);
  const h = out.headers;
  h.append("vary", "origin");
  if (!origin) return out;
  h.set("access-control-allow-origin", origin);
  h.set("access-control-allow-credentials", "true");
  if (methods !== undefined) {
    h.set("access-control-allow-methods", methods);
    h.set("access-control-allow-headers", "accept, authorization, content-type, x-keel");
    h.set("access-control-max-age", "600");
  }
  return out;
}
