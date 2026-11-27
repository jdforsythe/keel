// @vitest-environment node
// Spec: k.security, clause "`server.mjs` of a `keel build` fixture answers a `GET /` carrying both `Content-Length: 5` and `Transfer-Encoding: chunked`, a request with method `BREW`, a request line `GET / HTTP/9.9`, and a `GET /` whose header `x-a` holds a NUL byte, each 400 carrying the six k.security headers, with no handler run."
// Seed 1337 (fast-check: the unknown method). Method: local-routes-support.ts (real `keel build`, then `node dist/web/server.mjs` on a free port); each request is written over a raw socket (local-routes-raw.ts).
// "with no handler run" is read from the fixture's handler counts, unchanged. Each request carries a readable loopback `Host`, so the parser's rejection is the only cause of the refusal.
// ASSUMED: the status is read from the first line of the reply; a reply the parser rejects ends the connection, so the socket is read to its close.
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

const rejected = async (text: (port: number) => string, label: string): Promise<void> => {
  const { port } = up();
  const before = await counts(port);
  const r = await raw(port, text(port));
  expect(r.status, label).toBe(400);
  sixHeaders(r.headers, label);
  expect(await counts(port), label).toEqual(before);
};

describe("k.security Headers: a request the HTTP parser rejects is 400 with the headers", () => {
  it(
    "`server.mjs` of a `keel build` fixture answers a `GET /` carrying both `Content-Length: 5` and `Transfer-Encoding: chunked` 400 carrying the six k.security headers, with no handler run",
    async () => {
      await rejected(
        (p) =>
          `GET / HTTP/1.1\r\nHost: 127.0.0.1:${p}\r\nContent-Length: 5\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n0\r\n\r\n`,
        "Content-Length and Transfer-Encoding",
      );
    },
    T,
  );

  it(
    "`server.mjs` of a `keel build` fixture answers a request with method `BREW` 400 carrying the six k.security headers, with no handler run",
    async () => {
      await rejected((p) => `BREW / HTTP/1.1\r\nHost: 127.0.0.1:${p}\r\nConnection: close\r\n\r\n`, "BREW");
    },
    T,
  );

  it(
    "`server.mjs` of a `keel build` fixture answers a request line `GET / HTTP/9.9` 400 carrying the six k.security headers, with no handler run",
    async () => {
      await rejected((p) => `GET / HTTP/9.9\r\nHost: 127.0.0.1:${p}\r\nConnection: close\r\n\r\n`, "HTTP/9.9");
    },
    T,
  );

  it(
    "`server.mjs` of a `keel build` fixture answers a `GET /` whose header `x-a` holds a NUL byte 400 carrying the six k.security headers, with no handler run",
    async () => {
      await rejected(
        (p) => `GET / HTTP/1.1\r\nHost: 127.0.0.1:${p}\r\nx-a: a\u0000b\r\nConnection: close\r\n\r\n`,
        "NUL in x-a",
      );
    },
    T,
  );

  it(
    "an unknown method is 400 with the six headers and no handler run, as `BREW` is",
    async () => {
      const { port } = up();
      const method = fc.constantFrom("BREW", "FROB", "XYZZY", "TEAPOT", "WHEN", "KEELX");
      const before = await counts(port);
      await fc.assert(
        fc.asyncProperty(method, async (m) => {
          const r = await raw(port, `${m} / HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`);
          expect(r.status, m).toBe(400);
          sixHeaders(r.headers, m);
        }),
        { seed: SEED, numRuns: 20 },
      );
      expect(await counts(port)).toEqual(before);
    },
    T,
  );
});
