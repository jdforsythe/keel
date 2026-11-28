// @vitest-environment node
// Spec: k.contract, clause "The same `GET` with `Sec-Fetch-Site: cross-site`, with no `Sec-Fetch-Site`, or with `Host: example.com`, answers 403 `keel.denied` and its loader does not run."
// k.contract Local routes: "Any other request, one with no `Sec-Fetch-Site` among them, is 403 `keel.denied` and runs nothing."
// k.contract Local routes: "A page on another site (a cross-site navigation), a rebound name (a foreign `Host`) and another machine are each refused."
// Seed 1337 (fast-check: a `Sec-Fetch-Site` value other than the two allowed, a foreign host name). Method: local-routes-support.ts: the real `keel build`, then `node dist/web/server.mjs` over a real loopback connection; the handlers' own run counts are read back from the non-local `GET /api/counts`,
// and no response body may hold a handler's marker.
// ASSUMED: (1) a 403 `keel.denied` answer to a JSON request holds the text `keel.denied` in its body; for an HTML request only the 403 is asserted; (2) a `Sec-Fetch-Site` value is compared as sent: the generated values are lower-case tokens that are not `same-origin` or `none`.
// SILENT (reported, not asserted): a `Host` of a loopback name with a port other than the server's. The text says "`localhost`, `127.0.0.1` or `[::1]` with a port", not "with the server's port".
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
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
const MARKERS = ["PANEL_MARKER_7f3a91", "PROBE_MARKER_c20d48"];
type Heads = Record<string, string>;
/** Every header set here is sent over a loopback connection; `drop` removes one of the three good headers. */
const without = (host: string, port: number, drop: string, extra: Heads = {}): Heads => {
  const h: Heads = { ...good(host, port), ...extra };
  Reflect.deleteProperty(h, drop);
  return h;
};

/** `heads` to the local page (JSON and HTML), API GET and API POST: each is 403, none of the four handlers or the guard ran, no marker is in a body. */
async function refusedEverywhere(port: number, heads: Heads, label: string): Promise<void> {
  const before = await counts(port);
  const page = await ask(port, { path: "/panel", headers: heads });
  const html = await ask(port, { path: "/panel", headers: { ...heads, accept: "text/html" } });
  const probe = await ask(port, { path: "/api/probe", headers: heads });
  const post = await ask(port, {
    method: "POST",
    path: "/api/mutate",
    headers: { ...heads, "content-type": "application/json", origin: `http://${heads.host ?? ""}`, "x-keel": "1" },
    body: JSON.stringify({ note: "n" }),
  });
  for (const [what, r] of [
    ["page json", page],
    ["page html", html],
    ["api get", probe],
    ["api post", post],
  ] as const) {
    expect(r.status, `${label}: ${what}`).toBe(403);
    for (const m of MARKERS) expect(r.body.includes(m), `${label}: ${what} holds ${m}`).toBe(false);
  }
  for (const r of [page, probe, post]) expect(r.body, label).toContain("keel.denied");
  const after = await counts(port);
  expect(after.page, `${label}: page loader`).toBe(before.page);
  expect(after.probe, `${label}: api loader`).toBe(before.probe);
  expect(after.act, `${label}: action`).toBe(before.act);
  expect(after.guard, `${label}: guard`).toBe(before.guard);
}

describe("k.contract Local routes: the request that is refused", () => {
  it(
    "The same `GET` with `Sec-Fetch-Site: cross-site`, with no `Sec-Fetch-Site`, or with `Host: example.com`, answers 403 `keel.denied` and its loader does not run",
    async () => {
      const { port } = up();
      const before = await counts(port);
      for (const [label, heads] of [
        ["cross-site", good("127.0.0.1", port, { "sec-fetch-site": "cross-site" })],
        ["no Sec-Fetch-Site", without("127.0.0.1", port, "sec-fetch-site")],
        ["Host: example.com", { ...good("127.0.0.1", port), host: "example.com" }],
      ] as const) {
        const r = await ask(port, { path: "/panel", headers: heads });
        expect(r.status, label).toBe(403);
        expect(r.body, label).toContain("keel.denied");
        expect(r.body.includes("PANEL_MARKER_7f3a91"), label).toBe(false);
      }
      expect((await counts(port)).page).toBe(before.page);
    },
    T,
  );

  it(
    "a `Sec-Fetch-Site` of `same-site`, `cross-site` or no value is refused on the page, the API GET and the API POST, none of their handlers or the guard running",
    async () => {
      const { port } = up();
      await refusedEverywhere(port, good("127.0.0.1", port, { "sec-fetch-site": "same-site" }), "same-site");
      await refusedEverywhere(port, good("127.0.0.1", port, { "sec-fetch-site": "cross-site" }), "cross-site");
      await refusedEverywhere(port, without("127.0.0.1", port, "sec-fetch-site"), "absent");
    },
    T,
  );

  it(
    "any `Sec-Fetch-Site` value other than `same-origin` and `none` is refused over a loopback connection with a loopback `Host`",
    async () => {
      const { port } = up();
      const value = fc.stringMatching(/^[a-z][a-z-]{0,11}$/).filter((v) => v !== "same-origin" && v !== "none");
      const before = await counts(port);
      await fc.assert(
        fc.asyncProperty(value, async (v) => {
          const r = await ask(port, { path: "/panel", headers: good("localhost", port, { "sec-fetch-site": v }) });
          expect(r.status, v).toBe(403);
          expect(r.body.includes("PANEL_MARKER_7f3a91"), v).toBe(false);
        }),
        { seed: SEED, numRuns: 15 },
      );
      expect((await counts(port)).page).toBe(before.page);
    },
    T,
  );

  it(
    "a loopback connection with a `Host` that is not `localhost`, `127.0.0.1` or `[::1]` is refused, whatever the name",
    async () => {
      const { port } = up();
      const name = fc
        .tuple(fc.stringMatching(/^[a-z][a-z0-9]{0,9}$/), fc.constantFrom("com", "test", "org", "internal"))
        .map(([a, b]) => `${a}.${b}`)
        .filter((h) => h !== "localhost");
      const before = await counts(port);
      await fc.assert(
        fc.asyncProperty(name, fc.boolean(), async (h, withPort) => {
          const host = withPort ? `${h}:${port}` : h;
          const r = await ask(port, { path: "/panel", headers: { ...good("127.0.0.1", port), host } });
          expect(r.status, host).toBe(403);
          expect(r.body.includes("PANEL_MARKER_7f3a91"), host).toBe(false);
        }),
        { seed: SEED, numRuns: 15 },
      );
      for (const host of [
        `127.0.0.2:${port}`,
        `0.0.0.0:${port}`,
        `localhost.example.test:${port}`,
        `127.0.0.1.example.test:${port}`,
        `[::2]:${port}`,
        `[::ffff:127.0.0.1]:${port}`,
      ]) {
        const r = await ask(port, { path: "/panel", headers: { ...good("127.0.0.1", port), host } });
        expect(r.status, host).toBe(403);
      }
      expect((await counts(port)).page).toBe(before.page);
    },
    T,
  );

  it(
    "a loopback `Host` without a port (`localhost`, `127.0.0.1`, `[::1]`) is refused, the handlers not running",
    async () => {
      const { port } = up();
      for (const host of ["localhost", "127.0.0.1", "[::1]"])
        await refusedEverywhere(port, { ...good("127.0.0.1", port), host }, `Host: ${host}`);
    },
    T,
  );

  it(
    "a `Host: example.com` is refused on the page, the API GET and the API POST, none of their handlers or the guard running",
    async () => {
      const { port } = up();
      await refusedEverywhere(port, { ...good("127.0.0.1", port), host: `example.com:${port}` }, "example.com");
      await refusedEverywhere(port, { ...good("127.0.0.1", port), host: "example.com" }, "example.com, no port");
    },
    T,
  );

  it(
    "a route that is not `local`, on the same server, is answered to the requests a `local` route refuses",
    async () => {
      const { port } = up();
      const before = await counts(port);
      const heads: Heads[] = [
        good("127.0.0.1", port, { "sec-fetch-site": "cross-site" }),
        without("127.0.0.1", port, "sec-fetch-site"),
        { ...good("127.0.0.1", port), host: "example.com" },
      ];
      for (const h of heads) {
        const local = await ask(port, { path: "/api/probe", headers: h });
        const open = await ask(port, { path: "/api/open", headers: h });
        expect(local.status).toBe(403);
        expect(open.status).toBe(200);
        expect(open.body).toContain("OPEN_MARKER_58be10");
      }
      expect((await counts(port)).open - before.open).toBe(heads.length);
    },
    T,
  );
});
