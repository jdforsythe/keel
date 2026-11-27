import { type IncomingMessage, type ServerResponse, createServer, request } from "node:http";
import { connect } from "node:net";
import { TLSSocket } from "node:tls";
import type { AnswerEntry } from "./AnswerEntry.ts";
import type { ProxyServer } from "./ProxyServer.ts";
import { runCertificate } from "./runCertificate.ts";
import { sendResponse } from "./sendResponse.ts";
import { webRequest } from "./webRequest.ts";

const PEER = /^([a-z0-9-]+)\.peer\.keel\.test$/;

/**
 * A serve's proxy on 127.0.0.1: a request for a mapped origin goes to its `answer` (`https` ended with a certificate
 * made for this serve's mapped host names alone, on the run's key, `runCertificate`), one for `<name>.peer.keel.test` to that deployable's port (`peers`), and every other request
 * on, unchanged; a loopback one (Playwright sends those through it too) to its port, an answer cut off there cut off
 * for the page.
 */
export async function startProxy(
  origins: ReadonlyMap<string, AnswerEntry>,
  peers: (name: string) => number | undefined,
  reaches: (origin: string) => boolean,
): Promise<ProxyServer> {
  const tlsCert = runCertificate([...new Set([...origins.keys()].map((o) => new URL(o).hostname))]);
  const toAnswer = async (entry: AnswerEntry, req: IncomingMessage, res: ServerResponse, url: string) =>
    sendResponse(res, await entry.respond(await webRequest(req, url)));

  const pass = (req: IncomingMessage, res: ServerResponse, host: string, port: number, path: string): void => {
    const out = request({ host, port, path, method: req.method, headers: req.headers }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
      // An answer cut off upstream (a stopped deployable's event stream) is cut off for the page too.
      r.on("aborted", () => res.destroy());
      r.on("error", () => res.destroy());
    });
    out.on("error", () => {
      if (res.headersSent) res.destroy();
      else res.writeHead(502).end();
    });
    res.on("close", () => out.destroy());
    req.pipe(out);
  };

  // The https side of a mapped origin: requests arrive here once the tunnel's TLS is ended.
  const inner = createServer((req, res) => {
    const host = req.headers.host ?? "";
    const origin = `https://${host.replace(/:443$/, "")}`;
    const entry = origins.get(origin);
    if (entry === undefined) res.writeHead(502).end();
    else void toAnswer(entry, req, res, `${origin}${req.url ?? "/"}`);
  });

  const server = createServer((req, res) => {
    let url: URL;
    try {
      url = new URL(req.url ?? "");
    } catch {
      res.writeHead(400).end();
      return;
    }
    // Reach (k.e2e-run): a request for an origin the serve neither serves, peers nor maps goes nowhere; the page sees
    // a network error (no answer at all) and its tab records the `offsite` problem.
    if (!reaches(url.origin)) {
      req.socket.destroy();
      return;
    }
    const peer = PEER.exec(url.hostname)?.[1];
    const port = peer === undefined ? undefined : peers(peer);
    if (port !== undefined) return pass(req, res, "127.0.0.1", port, `${url.pathname}${url.search}`);
    const entry = origins.get(url.origin);
    if (entry !== undefined) return void toAnswer(entry, req, res, url.href);
    pass(req, res, url.hostname, Number(url.port || 80), `${url.pathname}${url.search}`);
  });
  server.on("connect", (req: IncomingMessage, socket, head: Buffer) => {
    const [host = "", portText = "443"] = (req.url ?? "").split(":");
    const port = Number(portText);
    const origin = port === 443 ? `https://${host}` : `https://${host}:${port}`;
    if (!reaches(origin) && !reaches(origin.replace(/^https:/, "http:"))) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    if (origins.has(origin)) {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      const tls = new TLSSocket(socket, { isServer: true, cert: tlsCert.cert, key: tlsCert.key });
      if (head.length > 0) socket.unshift(head);
      inner.emit("connection", tls);
      return;
    }
    const upstream = connect(port, host, () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length > 0) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
  });

  const port = await new Promise<number>((done, failed) => {
    server.once("error", failed);
    server.listen(0, "127.0.0.1", () => {
      const a = server.address();
      done(typeof a === "object" && a !== null ? a.port : 0);
    });
  });
  return {
    server: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections();
        inner.closeAllConnections();
        server.close(() => done());
      }),
  };
}
