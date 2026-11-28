// @vitest-environment node
// Spec: k.contract, clause "A `GET` of a `local: true` page from `127.0.0.1` with `Host: 127.0.0.1:<port>` and `Sec-Fetch-Site: none` answers the page, and its loader runs once."
// k.contract Local routes: "`local: true` on a page or API entry makes it a route of this machine alone, for a dev tool (the inspector). Before guards, loaders or actions run, the server answers a request matching it only when three things hold: the connection's remote address is a loopback address (`127.0.0.1`, `::1`); its `Host` is `localhost`, `127.0.0.1` or `[::1]` with a port; and its `Sec-Fetch-Site` is `same-origin` or `none`."
// Seed: n/a (the spaces here are finite and listed: two host names, two header values, two loopback families). Method: local-routes-support.ts: the real `keel build`, then `node dist/web/server.mjs` over a real connection; the fixture's own run counts are read back from its non-local `GET /api/counts`.
// SKIPPED with a stated reason: the `::1` cases need an IPv6 loopback address on this machine (`os.networkInterfaces()`).
// ASSUMED: (1) "answers the page" is 200 with an HTML document for `Accept: text/html`; (2) a `local: true` API entry is answered under the same three conditions as a page (the clause names a page; Local routes names "a page or API entry").
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HAS_V6, REMOVE, type Running, ask, buildFixture, counts, good, startServer } from "./local-routes-support.ts";

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

const T = fixedTime(60_000);

describe("k.contract Local routes: the request that is answered", () => {
  it(
    "A `GET` of a `local: true` page from `127.0.0.1` with `Host: 127.0.0.1:<port>` and `Sec-Fetch-Site: none` answers the page, and its loader runs once",
    async () => {
      const { port } = up();
      const before = await counts(port);
      const r = await ask(port, { path: "/panel", headers: good("127.0.0.1", port, { accept: "text/html" }) });
      expect(r.status).toBe(200);
      expect(r.headers["content-type"] ?? "").toContain("text/html");
      expect((await counts(port)).page - before.page).toBe(1);
    },
    T,
  );

  it(
    "a `local: true` page answers its data to a JSON request under the same three conditions, the loader once",
    async () => {
      const { port } = up();
      const before = await counts(port);
      const r = await ask(port, { path: "/panel", headers: good("127.0.0.1", port) });
      expect(r.status).toBe(200);
      expect(r.body).toContain("PANEL_MARKER_7f3a91");
      expect((await counts(port)).page - before.page).toBe(1);
    },
    T,
  );

  it(
    "a `local: true` API GET answers, its guard and loader running once each, and a `local: true` API POST runs its action once",
    async () => {
      const { port } = up();
      const before = await counts(port);
      const get = await ask(port, { path: "/api/probe", headers: good("127.0.0.1", port) });
      expect(get.status).toBe(200);
      expect(get.body).toContain("PROBE_MARKER_c20d48");
      const host = `127.0.0.1:${port}`;
      const post = await ask(port, {
        method: "POST",
        path: "/api/mutate",
        headers: {
          ...good("127.0.0.1", port),
          "content-type": "application/json",
          origin: `http://${host}`,
          "x-keel": "1",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ note: "n" }),
      });
      expect(post.status).toBe(200);
      const after = await counts(port);
      expect(after.probe - before.probe).toBe(1);
      expect(after.act - before.act).toBe(1);
      expect(after.guard - before.guard).toBe(2);
    },
    T,
  );

  it(
    "`localhost` and `127.0.0.1` with the server's port, with `Sec-Fetch-Site` `same-origin` or `none`, are each answered over a loopback connection",
    async () => {
      const { port } = up();
      for (const name of ["localhost", "127.0.0.1"])
        for (const site of ["same-origin", "none"]) {
          const before = await counts(port);
          const r = await ask(port, {
            path: "/panel",
            headers: good(name, port, { "sec-fetch-site": site }),
          });
          expect(r.status, `${name} ${site}`).toBe(200);
          expect((await counts(port)).page - before.page, `${name} ${site}`).toBe(1);
        }
    },
    T,
  );

  it.skipIf(!HAS_V6)(
    "an IPv6 loopback connection with `Host: [::1]:<port>` is answered, and so is `Host: localhost:<port>` over it",
    async () => {
      const { port } = up();
      for (const host of ["[::1]", "localhost"]) {
        const before = await counts(port);
        const r = await ask(port, { from: "::1", path: "/panel", headers: good(host, port) });
        expect(r.status, host).toBe(200);
        expect((await counts(port)).page - before.page, host).toBe(1);
      }
    },
    T,
  );

  it(
    "a request to a route that is not `local` is answered whatever its `Host` and `Sec-Fetch-Site`",
    async () => {
      const { port } = up();
      const before = await counts(port);
      const heads: Record<string, string>[] = [
        { host: "example.com", "sec-fetch-site": "cross-site" },
        { host: `127.0.0.1:${port}` },
        { host: `localhost:${port}`, "sec-fetch-site": "same-site" },
      ];
      for (const h of heads) {
        const r = await ask(port, { path: "/api/open", headers: { accept: "application/json", ...h } });
        expect(r.status, JSON.stringify(h)).toBe(200);
        expect(r.body).toContain("OPEN_MARKER_58be10");
      }
      expect((await counts(port)).open - before.open).toBe(heads.length);
    },
    T,
  );
});
