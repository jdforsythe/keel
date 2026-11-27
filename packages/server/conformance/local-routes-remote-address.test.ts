// @vitest-environment node
// Spec: k.contract, clause "A `GET` of that page over a connection from a non-loopback address of the machine, with `Host: localhost:<port>` and `Sec-Fetch-Site: same-origin`, answers 403 `keel.denied`."
// k.contract Local routes: "Before guards, loaders or actions run, the server answers a request matching it only when three things hold: the connection's remote address is a loopback address (`127.0.0.1`, `::1`); its `Host` is `localhost`, `127.0.0.1` or `[::1]` with a port; and its `Sec-Fetch-Site` is `same-origin` or `none`."
// k.contract Local routes: "A page on another site (a cross-site navigation), a rebound name (a foreign `Host`) and another machine are each refused."
// Seed: n/a (finite lists of forwarding headers). Method: local-routes-support.ts: the real `keel build`, then `node dist/web/server.mjs` with `HOST` unset (every interface), connected to by the machine's own non-loopback IPv4 address, so the server's remote address for the connection is that address.
// SKIPPED with a stated reason: the non-loopback cases need a non-loopback IPv4 address on this machine (`os.networkInterfaces()`); the loopback half runs everywhere.
// SILENT (reported, not asserted): whether `KEEL_PROXIES` changes which address is the peer's; the clause says "the connection's remote address" and names no forwarding header or setting, so the cases assert that no forwarding header changes it, with `KEEL_PROXIES` unset.
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LAN, REMOVE, type Running, ask, buildFixture, counts, good, startServer } from "./local-routes-support.ts";

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
const MARKERS = ["PANEL_MARKER_7f3a91", "PROBE_MARKER_c20d48"];
const lan = (): string => {
  if (LAN === undefined) throw new Error("no non-loopback address");
  return LAN;
};

describe("k.contract Local routes: the connection's remote address", () => {
  it.skipIf(LAN === undefined)(
    "A `GET` of that page over a connection from a non-loopback address of the machine, with `Host: localhost:<port>` and `Sec-Fetch-Site: same-origin`, answers 403 `keel.denied`",
    async () => {
      const { port } = up();
      const before = await counts(port);
      const r = await ask(port, {
        from: lan(),
        path: "/panel",
        headers: good("localhost", port, { "sec-fetch-site": "same-origin" }),
      });
      expect(r.status).toBe(403);
      expect(r.body).toContain("keel.denied");
      expect(r.body.includes("PANEL_MARKER_7f3a91")).toBe(false);
      expect((await counts(port)).page).toBe(before.page);
    },
    T,
  );

  it.skipIf(LAN === undefined)(
    "a connection from a non-loopback address is refused whichever loopback `Host` it names, on the page, the API GET and the API POST, no handler or guard running",
    async () => {
      const { port } = up();
      const before = await counts(port);
      for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
        const heads = good(host, port, { "sec-fetch-site": "same-origin" });
        const page = await ask(port, { from: lan(), path: "/panel", headers: heads });
        const probe = await ask(port, { from: lan(), path: "/api/probe", headers: heads });
        const post = await ask(port, {
          from: lan(),
          method: "POST",
          path: "/api/mutate",
          headers: { ...heads, "content-type": "application/json", origin: `http://${host}:${port}`, "x-keel": "1" },
          body: JSON.stringify({ note: "n" }),
        });
        for (const r of [page, probe, post]) {
          expect(r.status, host).toBe(403);
          for (const m of MARKERS) expect(r.body.includes(m), host).toBe(false);
        }
      }
      const after = await counts(port);
      expect([after.page, after.probe, after.act, after.guard]).toEqual([
        before.page,
        before.probe,
        before.act,
        before.guard,
      ]);
    },
    T,
  );

  it.skipIf(LAN === undefined)(
    "a forwarding header naming a loopback address does not make a non-loopback connection loopback",
    async () => {
      const { port } = up();
      const before = await counts(port);
      const forwards: Record<string, string>[] = [
        { "x-forwarded-for": "127.0.0.1" },
        { "x-forwarded-for": "::1" },
        { "x-forwarded-for": "127.0.0.1, 127.0.0.1" },
        { forwarded: "for=127.0.0.1;host=localhost" },
        { "x-real-ip": "127.0.0.1" },
        { "x-forwarded-host": `localhost:${port}`, "x-forwarded-proto": "http" },
        { "x-forwarded-for": "127.0.0.1", forwarded: "for=127.0.0.1", "x-real-ip": "127.0.0.1" },
      ];
      for (const f of forwards) {
        const r = await ask(port, {
          from: lan(),
          path: "/panel",
          headers: good("localhost", port, { "sec-fetch-site": "same-origin", ...f }),
        });
        expect(r.status, JSON.stringify(f)).toBe(403);
        expect(r.body.includes("PANEL_MARKER_7f3a91")).toBe(false);
      }
      expect((await counts(port)).page).toBe(before.page);
    },
    T,
  );

  it(
    "a forwarding header naming another address does not make a loopback connection non-loopback",
    async () => {
      const { port } = up();
      const forwards: Record<string, string>[] = [
        { "x-forwarded-for": "203.0.113.9" },
        { forwarded: "for=203.0.113.9" },
        { "x-real-ip": "203.0.113.9" },
        { "x-forwarded-for": "203.0.113.9, 127.0.0.1" },
      ];
      for (const f of forwards) {
        const before = await counts(port);
        const r = await ask(port, { path: "/panel", headers: good("127.0.0.1", port, f) });
        expect(r.status, JSON.stringify(f)).toBe(200);
        expect((await counts(port)).page - before.page).toBe(1);
      }
    },
    T,
  );
});
