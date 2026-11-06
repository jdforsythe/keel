import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { INSPECT_PATH } from "./INSPECT_PATH.ts";

/** Origins whose cross-origin reads are answered: loopback only, any port. */
const LOOPBACK = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/;
/** Largest live report a page may post. */
const MAX_BODY = 8 * 1024 * 1024;

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
type Live = { readonly graph: unknown; readonly stores: unknown };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** `data` of `.keel/<name>`, or `{}` when it is missing or unreadable (no build yet). */
const artifact = (root: string, name: string): unknown => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(path.join(root, ".keel", name), "utf8"));
    return isRecord(parsed) && isRecord(parsed.data) ? parsed.data : {};
  } catch {
    return {};
  }
};

/** A posted live report: `{ graph: { nodes: [], edges: [] }, stores: {} }`. */
const liveOf = (text: string): Live | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed) || !isRecord(parsed.graph) || !isRecord(parsed.stores)) return undefined;
  const { nodes, edges } = parsed.graph;
  return Array.isArray(nodes) && Array.isArray(edges) ? { graph: { nodes, edges }, stores: parsed.stores } : undefined;
};

const send = (res: ServerResponse, status: number, body?: unknown): void => {
  res.statusCode = status;
  res.setHeader("cache-control", "no-store");
  if (body === undefined) {
    res.end();
    return;
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
};

/**
 * `GET|POST /__keel/inspect` for the Vite dev and preview servers of a client-only app (k.cli Inspect, RFC 0017).
 * GET returns `{ live, graph, stores, ids, a11y, routes }`: artifacts read from `<root>/.keel/` per request, the live
 * half from the last report the open page posted (`live: false`, empty graph and stores, until one arrives). POST
 * takes that report, same-origin only. Cross-origin reads are answered for loopback origins only.
 */
export function inspectMiddleware(root: () => string): Middleware {
  let live: Live | undefined;
  return (req, res, next) => {
    if ((req.url ?? "").split("?")[0] !== INSPECT_PATH) return next();
    const origin = req.headers.origin;
    const loopback = typeof origin === "string" && LOOPBACK.test(origin);
    if (loopback) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("vary", "origin");
    }
    if (req.method === "GET") {
      const dir = root();
      return send(res, 200, {
        live: live !== undefined,
        graph: live?.graph ?? { nodes: [], edges: [] },
        stores: live?.stores ?? {},
        ids: artifact(dir, "ids.json"),
        a11y: artifact(dir, "a11y.json"),
        routes: artifact(dir, "routes.json"),
      });
    }
    if (req.method !== "POST") return send(res, 405);
    const sameOrigin = origin === undefined || (loopback && new URL(origin).host === req.headers.host);
    if (!sameOrigin || !(req.headers["content-type"] ?? "").startsWith("application/json")) return send(res, 403);
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size <= MAX_BODY) chunks.push(c);
    });
    req.on("end", () => {
      if (size > MAX_BODY) return send(res, 413);
      const report = liveOf(Buffer.concat(chunks).toString("utf8"));
      if (report === undefined) return send(res, 400);
      live = report;
      send(res, 204);
    });
  };
}
