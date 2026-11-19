import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { INSPECT_PATH } from "../inspect/INSPECT_PATH.ts";
import { LOOPBACK } from "../inspect/LOOPBACK.ts";
import { artifactData } from "../inspect/artifactData.ts";
import { originListed as listed } from "../inspect/originListed.ts";

/** Largest live report a page may post. */
const MAX_BODY = 8 * 1024 * 1024;

type Middleware = (req: IncomingMessage, res: ServerResponse, next: (e?: unknown) => void) => void;
type App = { fetch(req: Request): Promise<Response> };
type Live = { readonly graph: unknown; readonly stores: unknown; readonly sections: Record<string, unknown> };

/** A `Host` header value or an origin as a URL, or undefined when it does not parse. */
const hostOf = (s: string): URL | undefined => {
  try {
    return new URL(s.includes("://") ? s : `http://${s}`);
  } catch {
    return undefined;
  }
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** `data` of `.keel/<name>`, or `{}` when it is missing or unreadable (no build yet). */
const artifact = (root: string, name: string): unknown => {
  try {
    return artifactData(fs.readFileSync(path.join(root, ".keel", name), "utf8"));
  } catch {
    return {};
  }
};

/** A posted live report: `{ graph: { nodes: [], edges: [] }, stores: {}, sections?: {} }`. */
const liveOf = (text: string): Live | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed) || !isRecord(parsed.graph) || !isRecord(parsed.stores)) return undefined;
  const { nodes, edges } = parsed.graph;
  const { sections = {} } = parsed;
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !isRecord(sections)) return undefined;
  return { graph: { nodes, edges }, stores: parsed.stores, sections };
};

/**
 * The inspector sections the dev apps serve to `host`, each asked for its own inspect document: of two apps that serve
 * one id the earlier's section is kept. An app that refuses, or answers something else, adds none.
 */
const served = async (apps: readonly App[], host: string): Promise<Record<string, unknown>> => {
  const out: Record<string, unknown> = {};
  for (const app of [...apps].reverse()) {
    const answer = await app.fetch(new Request(`http://${host}${INSPECT_PATH}`, { headers: { host } }));
    const doc: unknown = answer.ok ? await answer.json().catch(() => undefined) : undefined;
    if (isRecord(doc) && isRecord(doc.sections)) Object.assign(out, doc.sections);
  }
  return out;
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
 * `GET|POST /__keel/inspect` for the Vite dev and preview servers (k.cli Inspect, RFC 0017).
 * GET returns `{ live, graph, stores, ids, a11y, routes, sections }`: artifacts read from `<root>/.keel/` per request, the live
 * half from the last report the open page posted (`live: false`, empty graph, stores and sections, until one arrives). Under
 * `keel dev`, `apps` gives the `node` deployables' dev apps: `sections` then also holds the sections each of them serves
 * (`served`), and a section of an app replaces the page's section of that id. POST takes the page's report as JSON. Both answer only (RFC 0022) a `Host` that is loopback or in `origins`, with an `Origin`
 * that is the server's own or in `origins` (`:*` for any port); others get 403 `keel.denied`. A GET may omit `Origin`
 * (a navigation or curl); a POST or any other method must send one. A listed cross-origin `Origin` is echoed for CORS.
 */
export function inspectMiddleware(
  root: () => string,
  origins: readonly string[] = [],
  apps: () => Promise<readonly App[]> = () => Promise.resolve([]),
): Middleware {
  let live: Live | undefined;
  return (req, res, next) => {
    if ((req.url ?? "").split("?")[0] !== INSPECT_PATH) return next();
    const origin = req.headers.origin;
    const self = hostOf(req.headers.host ?? "");
    const from = origin === undefined ? undefined : hostOf(origin);
    const hostOk =
      self !== undefined &&
      (LOOPBACK.has(self.hostname) ||
        listed(origins, `http://${self.host}`) ||
        listed(origins, `https://${self.host}`));
    const write = req.method !== "GET" && req.method !== "HEAD";
    const same = origin === undefined ? !write : from !== undefined && from.host === self?.host;
    const crossOk = origin !== undefined && !same && listed(origins, origin);
    if (!hostOk || !(same || crossOk))
      return send(res, 403, { ok: false, error: { code: "keel.denied", message: "inspect origin refused", data: {} } });
    if (crossOk) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("vary", "origin");
    }
    if (req.method === "GET") {
      const dir = root();
      return void apps()
        .then((list) => served(list, self.host))
        .then(
          (sections) =>
            send(res, 200, {
              live: live !== undefined,
              graph: live?.graph ?? { nodes: [], edges: [] },
              stores: live?.stores ?? {},
              sections: { ...live?.sections, ...sections },
              ids: artifact(dir, "ids.json"),
              a11y: artifact(dir, "a11y.json"),
              routes: artifact(dir, "routes.json"),
            }),
          next,
        );
    }
    if (req.method !== "POST") return send(res, 405);
    if (!(req.headers["content-type"] ?? "").startsWith("application/json")) return send(res, 403);
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
