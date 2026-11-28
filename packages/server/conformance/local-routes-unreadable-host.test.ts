// @vitest-environment node
// Spec: k.contract, clause "`server.mjs` of a `keel build` fixture answers a `GET /` with `Host: a b`, with `Host: [::1`, with `Host: 127.0.0.1 :<port>`, and with two `Host: 127.0.0.1:<port>` headers, each 403 `keel.denied` carrying the six k.security headers."
// Seed 1337 (fast-check: unreadable `Host` values with a space in them). Method: local-routes-support.ts (real `keel build`, then `node dist/web/server.mjs` on a free port); each request is written over a raw socket (local-routes-raw.ts), because an HTTP client would not send these `Host` lines.
// ASSUMED: (1) a 403 `keel.denied` answer's body holds the text `keel.denied`; (2) "never 400" is the status read from the first line of the reply; (3) "reaches no route" is read from the fixture's handler counts, unchanged.
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

const request = (target: string, hostLines: string[]): string =>
  `GET ${target} HTTP/1.1\r\n${hostLines.map((h) => `${h}\r\n`).join("")}Connection: close\r\n\r\n`;
const refused = async (hostLines: (port: number) => string[], label: string): Promise<void> => {
  const { port } = up();
  const before = await counts(port);
  for (const target of ["/", "/panel", "/api/probe"]) {
    const r = await raw(port, request(target, hostLines(port)));
    expect(r.status, `${label} ${target}`).toBe(403);
    expect(r.status, `${label} ${target}`).not.toBe(400);
    expect(r.body, `${label} ${target}`).toContain("keel.denied");
    sixHeaders(r.headers, `${label} ${target}`);
  }
  expect(await counts(port), label).toEqual(before);
};

describe("k.contract Local routes: a `Host` the server cannot read is refused, never 400", () => {
  it(
    "`server.mjs` of a `keel build` fixture answers a `GET /` with `Host: a b` 403 `keel.denied` carrying the six k.security headers",
    async () => {
      await refused(() => ["Host: a b"], "Host: a b");
    },
    T,
  );

  it(
    "`server.mjs` of a `keel build` fixture answers a `GET /` with `Host: [::1` 403 `keel.denied` carrying the six k.security headers",
    async () => {
      await refused(() => ["Host: [::1"], "Host: [::1");
    },
    T,
  );

  it(
    "`server.mjs` of a `keel build` fixture answers a `GET /` with `Host: 127.0.0.1 :<port>` 403 `keel.denied` carrying the six k.security headers",
    async () => {
      await refused((p) => [`Host: 127.0.0.1 :${p}`], "Host: 127.0.0.1 :<port>");
    },
    T,
  );

  it(
    "`server.mjs` of a `keel build` fixture answers a `GET /` with two `Host: 127.0.0.1:<port>` headers 403 `keel.denied` carrying the six k.security headers",
    async () => {
      await refused((p) => [`Host: 127.0.0.1:${p}`, `Host: 127.0.0.1:${p}`], "two Host headers");
    },
    T,
  );

  it(
    "a `Host` with a space in it, whatever its parts, is 403 `keel.denied` with the six headers, never 400",
    async () => {
      const { port } = up();
      const part = fc.stringMatching(/^[a-z0-9.]{1,8}$/);
      await fc.assert(
        fc.asyncProperty(part, part, fc.constantFrom("", ":9100"), async (a, b, suffix) => {
          const host = `${a} ${b}${suffix}`;
          const r = await raw(port, request("/", [`Host: ${host}`]));
          expect(r.status, host).toBe(403);
          expect(r.body, host).toContain("keel.denied");
          sixHeaders(r.headers, host);
        }),
        { seed: SEED, numRuns: 25 },
      );
    },
    T,
  );
});
