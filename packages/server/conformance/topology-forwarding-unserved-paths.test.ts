// @vitest-environment happy-dom
// Spec: k.topology, clause "`x` answers a path of `b` with `y`'s status, headers and body, or 502 `keel.unreachable` with `y` down; one carrying `x-keel-forwarded` is not forwarded."
// Seed: 1337. No wall time; the peer answers through a sim net route.
// Fixture: deployable `x` serves module `a`, deployable `y` serves module `b`; `x` names `y` in `peers` by URL
// `http://y.test`, and `routes.json` in `artifacts` tells `x` which paths `y` serves.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { topology } from "@keel/server";
import { SEED, createAppLoose, pageManifest, simCtx, writeArtifacts, type Fetcher } from "./topology-fixtures.ts";

const HOP = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];
const DROPPED_RESPONSE = [...HOP, "content-encoding"];

describe("k.topology: forwarding of unserved paths", () => {
  test("`x` answers a path of `b` with `y`'s status, headers and body; one carrying `x-keel-forwarded` is not forwarded.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{1,8}$/), fc.stringMatching(/^[a-z0-9]{0,6}$/), async (title, q) => {
        const a = pageManifest("a", "/a", "A");
        const b = pageManifest("b", "/b", title);
        const t = topology({ x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } });
        const yCtx = simCtx();
        const y: Fetcher = await createAppLoose({ topology: t, deployable: "y", routes: b, ctx: yCtx });
        const seen: Request[] = [];
        const xCtx = simCtx();
        xCtx.net.route("http://y.test/*", (req) => {
          seen.push(req.clone());
          return y.fetch(req);
        });
        const x = await createAppLoose({
          topology: t,
          deployable: "x",
          routes: a,
          ctx: xCtx,
          peers: { y: "http://y.test" },
          artifacts: writeArtifacts(pageManifest("b", "/b", title)),
        });
        const url = `http://localhost/b${q === "" ? "" : `?q=${q}`}`;
        const headers = { accept: "application/json", "x-trace": q };
        const direct = await y.fetch(new Request(url, { headers }));
        const viaX = await x.fetch(new Request(url, { headers }));
        expect(viaX.status).toBe(direct.status);
        expect(await viaX.text()).toBe(await direct.text());
        expect(viaX.headers.get("content-type")).toBe(direct.headers.get("content-type"));
        expect(seen).toHaveLength(1);
        expect(new URL(seen[0]?.url ?? "").search).toBe(q === "" ? "" : `?q=${q}`);
        expect(seen[0]?.headers.get("x-trace")).toBe(q);
        expect(seen[0]?.headers.get("x-keel-forwarded")).not.toBeNull();

        const again = await x.fetch(new Request(url, { headers: { ...headers, "x-keel-forwarded": "1" } }));
        expect(again.status).toBe(404);
        expect(seen).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("the forwarded request carries every header but `host` and hop-by-hop ones, and the response every header but those and `content-encoding`", async () => {
    // Seed 1337 (fc.assert below).
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.tuple(fc.stringMatching(/^x-[a-z]{1,8}$/), fc.stringMatching(/^[a-z0-9]{1,8}$/)), {
          selector: (e) => e[0],
          minLength: 1,
          maxLength: 6,
        }),
        fc.stringMatching(/^[a-z]{1,8}$/),
        async (extra, title) => {
          const a = pageManifest("a", "/a", "A");
          const b = pageManifest("b", "/b", title);
          const t = topology({ x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } });
          const y: Fetcher = await createAppLoose({ topology: t, deployable: "y", routes: b, ctx: simCtx() });
          const seen: Request[] = [];
          const xCtx = simCtx();
          xCtx.net.route("http://y.test/*", (req) => {
            seen.push(req.clone());
            return y.fetch(req);
          });
          const x = await createAppLoose({
            topology: t,
            deployable: "x",
            routes: a,
            ctx: xCtx,
            peers: { y: "http://y.test" },
            artifacts: writeArtifacts(pageManifest("b", "/b", title)),
          });
          const sent: Record<string, string> = { accept: "application/json", "accept-language": "en" };
          for (const [k, v] of extra) if (k !== "x-keel-forwarded") sent[k] = v;
          const viaX = await x.fetch(new Request("http://localhost/b", { headers: sent }));
          const direct = await y.fetch(new Request("http://localhost/b", { headers: sent }));
          expect(seen).toHaveLength(1);
          const got = seen[0]?.headers;
          for (const [k, v] of Object.entries(sent)) expect(got?.get(k)).toBe(v);
          for (const h of HOP) expect(got?.get(h)).toBeNull();
          direct.headers.forEach((v, k) => {
            if (!DROPPED_RESPONSE.includes(k)) expect(viaX.headers.get(k)).toBe(v);
          });
          for (const h of DROPPED_RESPONSE) expect(viaX.headers.get(h)).toBeNull();
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("`x` answers a path of `b` with 502 `keel.unreachable` with `y` down, naming no host.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{1,8}$/), fc.string({ maxLength: 12 }), async (title, cause) => {
        const a = pageManifest("a", "/a", "A");
        const t = topology({ x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } });
        const xCtx = simCtx();
        xCtx.net.route("http://y.test/*", () => Promise.reject(new Error(`ECONNREFUSED y.test ${cause}`)));
        const x = await createAppLoose({
          topology: t,
          deployable: "x",
          routes: a,
          ctx: xCtx,
          peers: { y: "http://y.test" },
          artifacts: writeArtifacts(pageManifest("b", "/b", title)),
        });
        const res = await x.fetch(new Request("http://localhost/b", { headers: { accept: "application/json" } }));
        expect(res.status).toBe(502);
        const body = await res.text();
        expect(body).toContain("keel.unreachable");
        expect(body).not.toContain("keel.unexpected");
        expect(body).not.toContain("y.test");
        expect(body).not.toContain("ECONNREFUSED");
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
