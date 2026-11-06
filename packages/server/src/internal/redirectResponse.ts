/** A redirect: 302 (guard denial on GET), 303 (after an action or a denied write), 308 (trailing slash). */
export function redirectResponse(status: 302 | 303 | 308, location: string): Response {
  return new Response(null, {
    status,
    headers: status === 308 ? { location } : { location, "cache-control": "no-store" },
  });
}
