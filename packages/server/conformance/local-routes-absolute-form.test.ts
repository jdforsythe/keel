// @vitest-environment node
// Spec: k.contract, clause "`server.mjs` answers `GET http://example.com/tools` of a `local: true` page, from `127.0.0.1`, `Host: 127.0.0.1:<port>`, `Sec-Fetch-Site: none`, 403 `keel.denied`; `GET http://127.0.0.1:<port>/tools`, `Host: example.com`, the page; `GET /`, `Host: 127.0.0.1:0`, 403 `keel.denied` with the six k.security headers."
// Seed 1337 (fast-check: the count of zeros in a `Host` port). Method: local-routes-support.ts (real `keel build`, then `node dist/web/server.mjs` on a free port); each request is written whole over a raw socket
// (local-routes-raw.ts) from `127.0.0.1`. The fixture's `local: true` page is `app.panel` at `/panel` (the clause's `/tools`), its loader counting its runs, read from the non-local `/api/counts`.
// Also covered, from the RFC 0244 sketch and the clause's own sentences: "A request in absolute form (`GET http://host/path`) is judged by its authority, not `Host` (RFC 9112): a foreign one is refused whatever `Host` says"
// and "port 0, where no server listens" among the `Host` values `server.mjs` cannot read, 403 `keel.denied` on any route.
// ASSUMED: (1) "the page" is a 200 answer whose loader ran once; (2) a `Host` port of `00` reads as port 0 and is unreadable alike; (3) an absolute target with authority port 0 is judged by that authority and is 403.
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REMOVE, type Running, SEED, buildFixture, counts, startServer } from "./local-routes-support.ts";
import { raw, sixHeaders } from "./local-routes-raw.ts";

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

const get = (target: string, host: string): string =>
  `GET ${target} HTTP/1.1\r\nHost: ${host}\r\nSec-Fetch-Site: none\r\nAccept: text/html\r\nConnection: close\r\n\r\n`;

describe("k.contract Local routes: a request in absolute form is judged by its authority; a `Host` port of 0 is unreadable", () => {
  it(
    "`server.mjs` answers `GET http://example.com/tools` of a `local: true` page, from `127.0.0.1`, `Host: 127.0.0.1:<port>`, `Sec-Fetch-Site: none`, 403 `keel.denied`",
    async () => {
      const { port } = up();
      const before = await counts(port);
      const r = await raw(port, get("http://example.com/panel", `127.0.0.1:${port}`));
      expect(r.status).toBe(403);
      expect(r.body).toContain("keel.denied");
      expect(await counts(port)).toEqual(before);
    },
    T,
  );

  it(
    "`GET http://127.0.0.1:<port>/tools`, `Host: example.com`, answers the page",
    async () => {
      const { port } = up();
      const before = await counts(port);
      const r = await raw(port, get(`http://127.0.0.1:${port}/panel`, "example.com"));
      expect(r.status).toBe(200);
      expect(r.body).not.toContain("keel.denied");
      expect((await counts(port)).page).toBe(before.page + 1);
    },
    T,
  );

  it(
    "`GET /`, `Host: 127.0.0.1:0`, is 403 `keel.denied` with the six k.security headers",
    async () => {
      const { port } = up();
      const r = await raw(port, get("/", "127.0.0.1:0"));
      expect(r.status).toBe(403);
      expect(r.body).toContain("keel.denied");
      sixHeaders(r.headers, "Host: 127.0.0.1:0");
    },
    T,
  );

  it(
    "a `Host` port of `0`, `00` or any run of zeros is 403 `keel.denied` with the six k.security headers on any route",
    async () => {
      const { port } = up();
      const before = await counts(port);
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 4 }),
          fc.constantFrom("/", "/panel", "/api/probe"),
          async (n, target) => {
            const r = await raw(port, get(target, `127.0.0.1:${"0".repeat(n)}`));
            expect(r.status, `${n} ${target}`).toBe(403);
            expect(r.body, `${n} ${target}`).toContain("keel.denied");
            sixHeaders(r.headers, `${n} ${target}`);
          },
        ),
        { seed: SEED, numRuns: 12 },
      );
      expect(await counts(port)).toEqual(before);
    },
    T,
  );

  it(
    "a `Host` port of `00` is 403 `keel.denied` with the six k.security headers",
    async () => {
      const { port } = up();
      const r = await raw(port, get("/", "127.0.0.1:00"));
      expect(r.status).toBe(403);
      expect(r.body).toContain("keel.denied");
      sixHeaders(r.headers, "Host: 127.0.0.1:00");
    },
    T,
  );

  it(
    "an absolute target with port 0 is 403 `keel.denied`, whatever a loopback `Host` says",
    async () => {
      const { port } = up();
      const before = await counts(port);
      const r = await raw(port, get("http://127.0.0.1:0/panel", `127.0.0.1:${port}`));
      expect(r.status).toBe(403);
      expect(r.body).toContain("keel.denied");
      sixHeaders(r.headers, "absolute port 0");
      expect(await counts(port)).toEqual(before);
    },
    T,
  );
});
