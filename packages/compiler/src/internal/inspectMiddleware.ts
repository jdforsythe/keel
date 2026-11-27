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
/** A `node` deployable's dev app under `keel dev`, with its deployable's name. */
type Named = { readonly name: string; readonly app: App };
type Live = {
  readonly graph: unknown;
  readonly stores: unknown;
  readonly sections: Record<string, unknown>;
  readonly deployable: string | undefined;
};

/** A `Host` header value or an origin as a URL, or undefined when it does not parse. */
const hostOf = (s: string): URL | undefined => {
  try {
    return new URL(s.includes("://") ? s : `http://${s}`);
  } catch {
    return undefined;
  }
};

/** Whether a connection's remote address is this machine's loopback (`127.0.0.0/8`, `::1`, or either mapped into IPv6). */
const loopbackPeer = (address: string | undefined): boolean =>
  address !== undefined && (address === "::1" || /^(::ffff:)?127\.\d+\.\d+\.\d+$/.test(address));

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** `data` of `.keel/<name>`, or `{}` when it is missing or unreadable (no build yet). */
const artifact = (root: string, name: string): unknown => {
  try {
    return artifactData(fs.readFileSync(path.join(root, ".keel", name), "utf8"));
  } catch {
    return {};
  }
};

/** A posted live report: `{ graph: { nodes: [], edges: [] }, stores: {}, sections?: {}, deployable?: string }`. */
const liveOf = (text: string): Live | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed) || !isRecord(parsed.graph) || !isRecord(parsed.stores)) return undefined;
  const { nodes, edges } = parsed.graph;
  const { sections = {}, deployable } = parsed;
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !isRecord(sections)) return undefined;
  if (deployable !== undefined && typeof deployable !== "string") return undefined;
  return { graph: { nodes, edges }, stores: parsed.stores, sections, deployable };
};

/**
 * The inspector sections each dev app serves to `host`, by deployable, each app asked for its own inspect document.
 * An app that refuses, or answers something else, serves none.
 */
const served = async (apps: readonly Named[], host: string): Promise<Record<string, Record<string, unknown>>> => {
  const out: Record<string, Record<string, unknown>> = {};
  for (const { name, app } of apps) {
    const answer = await app.fetch(new Request(`http://${host}${INSPECT_PATH}`, { headers: { host } }));
    const doc: unknown = answer.ok ? await answer.json().catch(() => undefined) : undefined;
    out[name] = isRecord(doc) && isRecord(doc.sections) ? doc.sections : {};
  }
  return out;
};

/** The union of the apps' sections over `page`: an app's section replaces the page's, and the first app by name wins. */
const union = (
  page: Readonly<Record<string, unknown>>,
  apps: Readonly<Record<string, Record<string, unknown>>>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...page };
  for (const name of Object.keys(apps).sort().reverse()) Object.assign(out, apps[name]);
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
 * `keel dev`, `apps` gives the `node` deployables' dev apps by name: the document then also holds `deployables`,
 * `{ [name]: { sections } }`, each app's own sections (`served`) and, under the `deployable` a page's report names,
 * the sections that page last posted; `sections` is their union, an app's section replacing the page's of that id
 * and, of two apps, the first by name kept. POST takes the page's report as JSON. Both answer only (RFC 0022) a `Host` that is loopback or in `origins`, with an `Origin`
 * that is the server's own or in `origins` (`:*` for any port); others get 403 `keel.denied`. A GET may omit `Origin`
 * (a navigation or curl); a POST or any other method must send one. A listed cross-origin `Origin` is echoed for CORS.
 * Whatever the headers say, a connection whose remote address is not loopback is 403 `keel.denied` too (k.topology Local
 * topology: under `keel dev --host` the store values it holds stay on this machine).
 */
export function inspectMiddleware(
  root: () => string,
  origins: readonly string[] = [],
  apps: () => Promise<readonly Named[]> = () => Promise.resolve([]),
): Middleware {
  let live: Live | undefined;
  /** The sections each `client` deployable's page last posted, by the name its report carries. */
  const pages = new Map<string, Record<string, unknown>>();
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
    if (!loopbackPeer(req.socket.remoteAddress) || !hostOk || !(same || crossOk))
      return send(res, 403, { ok: false, error: { code: "keel.denied", message: "inspect origin refused", data: {} } });
    if (crossOk) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("vary", "origin");
    }
    if (req.method === "GET") {
      const dir = root();
      return void apps()
        .then(async (list) => (list.length === 0 ? undefined : await served(list, self.host)))
        .then(
          (byApp) =>
            send(res, 200, {
              live: live !== undefined,
              graph: live?.graph ?? { nodes: [], edges: [] },
              stores: live?.stores ?? {},
              sections: union(live?.sections ?? {}, byApp ?? {}),
              ...(byApp === undefined
                ? {}
                : {
                    deployables: Object.fromEntries(
                      [...new Set([...pages.keys(), ...Object.keys(byApp)])]
                        .sort()
                        .map((name) => [name, { sections: { ...pages.get(name), ...byApp[name] } }]),
                    ),
                  }),
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
      if (report.deployable !== undefined) pages.set(report.deployable, report.sections);
      send(res, 204);
    });
  };
}
