// @vitest-environment node
// Spec: k.contract, clause "`server.mjs` of a `keel build` fixture answers an HTTP/1.0 `GET /` with no `Host`, a `GET /` with `Host: [::ffff:127.0.0.1]:<port>`, and a `GET` of its `local: true` page from `127.0.0.1` with `Host: 127.0.0.1:<port>` and `Sec-Fetch-Site: cross-site`, each 403 `keel.denied` carrying the six k.security headers."
// k.contract Local routes: "A request to `server.mjs` with no `Host` (HTTP/1.0), or with one it cannot read back (`[::ffff:127.0.0.1]:<port>`), reaches no route, `local` or not, and is 403 `keel.denied` like a foreign `Host`, never 400. Every refusal here, that one and a forwarding deployable's (k.topology Calls and peers) included, carries the k.security headers."
// k.security Headers: "Every `createApp` response (documents, JSON, event streams, assets, redirects, errors) and every refusal `server.mjs` answers before it (a `Host` it cannot read, or none: k.contract Local routes) carries `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `X-Frame-Options: DENY` and `Permissions-Policy: camera=(), microphone=(), payment=(), usb=()`; on https (the cookie's rule below) also `Strict-Transport-Security: max-age=63072000`."
// Seed 1337 (fast-check: unreadable `Host` values, routes). Method: local-routes-support.ts (real `keel build`, then `node dist/web/server.mjs` on a free port); a request with no `Host` is written over a raw socket as HTTP/1.0, because an HTTP client adds one.
// ASSUMED: (1) a 403 `keel.denied` answer's body holds the text `keel.denied` (JSON or HTML); (2) the headers are compared case-insensitively by name, exactly by value; (3) a body is read to the end of the connection (HTTP/1.0 closes it).
// SILENT (not asserted): what an HTTP/1.1 request with no `Host` gets; the spec's parenthesis names HTTP/1.0 only.
import net from "node:net";
import fc from "fast-check";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REMOVE, type Running, SEED, ask, buildFixture, counts, good, startServer } from "./local-routes-support.ts";

let root = "";
let srv: Running | undefined;
const up = (): Running => {
  if (srv === undefined) throw new Error("server not started");
  return srv;
};
beforeAll(async () => {
  const b = buildFixture();
  root = b.root;
  expect(b.status, b.out).toBe(0);
  srv = await startServer(root);
}, fixedTime(600_000));
afterAll(() => {
  srv?.stop();
  REMOVE(root);
});
const T = fixedTime(120_000);

const SIX: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), payment=(), usb=()",
};
const sixHeaders = (headers: Record<string, string | string[] | undefined>, label: string): void => {
  for (const [name, value] of Object.entries(SIX)) expect(headers[name], `${label}: ${name}`).toBe(value);
};

type Raw = { status: number; headers: Record<string, string>; body: string };
/** `text` written as is to a fresh connection; read until the server closes it. */
const raw = (port: number, text: string): Promise<Raw> =>
  new Promise((resolve, reject) => {
    const sock = net.connect(port, "127.0.0.1");
    const chunks: Buffer[] = [];
    sock.on("data", (c: Buffer) => chunks.push(c));
    sock.on("error", reject);
    sock.on("close", () => {
      const all = Buffer.concat(chunks).toString("utf8");
      const cut = all.indexOf("\r\n\r\n");
      const head = (cut < 0 ? all : all.slice(0, cut)).split("\r\n");
      const headers: Record<string, string> = {};
      for (const line of head.slice(1)) {
        const i = line.indexOf(":");
        if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
      }
      resolve({
        status: Number(head[0]?.split(" ")[1] ?? 0),
        headers,
        body: cut < 0 ? "" : all.slice(cut + 4),
      });
    });
    sock.write(text);
  });
const http10 = (port: number, target: string): Promise<Raw> => raw(port, `GET ${target} HTTP/1.0\r\n\r\n`);

describe("k.contract Local routes: every refusal carries the k.security headers", () => {
  it(
    "`server.mjs` of a `keel build` fixture answers an HTTP/1.0 `GET /` with no `Host` 403 `keel.denied` carrying the six k.security headers",
    async () => {
      const r = await http10(up().port, "/");
      expect(r.status).toBe(403);
      expect(r.body).toContain("keel.denied");
      sixHeaders(r.headers, "no Host");
    },
    T,
  );

  it(
    "`server.mjs` of a `keel build` fixture answers a `GET /` with `Host: [::ffff:127.0.0.1]:<port>` 403 `keel.denied` carrying the six k.security headers",
    async () => {
      const { port } = up();
      const r = await ask(port, { path: "/", headers: { host: `[::ffff:127.0.0.1]:${port}` } });
      expect(r.status).toBe(403);
      expect(r.body).toContain("keel.denied");
      sixHeaders(r.headers, "unreadable Host");
    },
    T,
  );

  it(
    "`server.mjs` of a `keel build` fixture answers a `GET` of its `local: true` page from `127.0.0.1` with `Host: 127.0.0.1:<port>` and `Sec-Fetch-Site: cross-site` 403 `keel.denied` carrying the six k.security headers",
    async () => {
      const { port } = up();
      const r = await ask(port, {
        path: "/panel",
        headers: good("127.0.0.1", port, { "sec-fetch-site": "cross-site" }),
      });
      expect(r.status).toBe(403);
      expect(r.body).toContain("keel.denied");
      sixHeaders(r.headers, "cross-site");
    },
    T,
  );

  it(
    "a `local` page refused for a foreign `Host` (the rejected-Host 403) carries the six k.security headers",
    async () => {
      const { port } = up();
      const r = await ask(port, { path: "/panel", headers: { ...good("127.0.0.1", port), host: "example.com" } });
      expect(r.status).toBe(403);
      expect(r.body).toContain("keel.denied");
      sixHeaders(r.headers, "foreign Host");
    },
    T,
  );

  it(
    "a request with no `Host` (HTTP/1.0) to a `local` route is 403 `keel.denied`, never 400, and runs no handler",
    async () => {
      const { port } = up();
      const before = await counts(port);
      for (const target of ["/panel", "/api/probe"]) {
        const r = await http10(port, target);
        expect(r.status, target).toBe(403);
        expect(r.status, target).not.toBe(400);
        expect(r.body, target).toContain("keel.denied");
        sixHeaders(r.headers, target);
      }
      const after = await counts(port);
      expect(after.page).toBe(before.page);
      expect(after.probe).toBe(before.probe);
      expect(after.guard).toBe(before.guard);
    },
    T,
  );

  it(
    "a request with no `Host` (HTTP/1.0) to a route that is not `local`, or to no route, is 403 `keel.denied`, never 400, and runs no handler",
    async () => {
      const { port } = up();
      const before = await counts(port);
      for (const target of ["/api/open", "/api/counts", "/nowhere"]) {
        const r = await http10(port, target);
        expect(r.status, target).toBe(403);
        expect(r.status, target).not.toBe(400);
        expect(r.body, target).toContain("keel.denied");
        sixHeaders(r.headers, target);
      }
      expect((await counts(port)).open).toBe(before.open);
    },
    T,
  );

  it(
    "a `Host` the server cannot read back is 403 `keel.denied` with the six headers, never 400, on a `local` route and on any other",
    async () => {
      const { port } = up();
      const octet = fc.integer({ min: 0, max: 255 });
      const host = fc.tuple(octet, octet, octet, octet).map(([a, b, c, d]) => `[::ffff:${a}.${b}.${c}.${d}]:${port}`);
      const target = fc.constantFrom("/", "/panel", "/api/probe", "/api/open", "/nowhere");
      const before = await counts(port);
      await fc.assert(
        fc.asyncProperty(host, target, async (h, t) => {
          const r = await ask(port, { path: t, headers: { ...good("127.0.0.1", port), host: h } });
          expect(r.status, `${h} ${t}`).toBe(403);
          expect(r.body, `${h} ${t}`).toContain("keel.denied");
          sixHeaders(r.headers, `${h} ${t}`);
        }),
        { seed: SEED, numRuns: 25 },
      );
      expect(await counts(port)).toEqual(before);
    },
    T,
  );
});
