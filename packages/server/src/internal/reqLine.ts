import { written } from "./written.ts";

/**
 * A dev log `req` record (k.server Dev server, docs/OUTPUT.md): compact `GET /orders/7 orders.show 200 12ms`
 * (route omitted when none matched) or one NDJSON object. The method is `written` to 256 characters and the path to
 * 2,048 (k.serverlog).
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
  const method = written(r.method, 256);
  const path = written(r.path, 2048);
  if (format === "json")
    return JSON.stringify({
      kind: "req",
      method,
      path,
      ...(r.route === undefined ? {} : { route: r.route }),
      status: r.status,
      ms: r.ms,
    });
  return [method, path, r.route, String(r.status), `${r.ms}ms`].filter((p) => p !== undefined).join(" ");
}
