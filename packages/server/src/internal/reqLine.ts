/**
 * A dev log `req` record (k.server Dev server, docs/OUTPUT.md): compact `GET /orders/7 orders.show 200 12ms`
 * (route omitted when none matched) or one NDJSON object.
 */
export function reqLine(
  format: "compact" | "json",
  r: {
    readonly method: string;
    readonly path: string;
    readonly route: string | undefined;
    readonly status: number;
    readonly ms: number;
  },
): string {
  if (format === "json")
    return JSON.stringify({
      kind: "req",
      method: r.method,
      path: r.path,
      ...(r.route === undefined ? {} : { route: r.route }),
      status: r.status,
      ms: r.ms,
    });
  return [r.method, r.path, r.route, String(r.status), `${r.ms}ms`].filter((p) => p !== undefined).join(" ");
}
