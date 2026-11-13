// @vitest-environment node
// k.security on the server beyond its conformance: nonces never repeat across seeds, the `csp.txt` policy and the
// hosted index.html carry each keel-peer origin, the report endpoint's method, type and multi-report bodies, and a write
// behind a TLS-terminating proxy passes the same-site check by the forwarded proto. Seed 1337.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { cspPolicy, securityHeaders } from "../src/csp/index.ts";
import { createApp, topology } from "../src/index.ts";
import { blockedOf } from "../src/internal/blockedOf.ts";
import { nonceOf } from "../src/internal/nonceOf.ts";
import { peersOfIndex } from "../src/internal/peersOfIndex.ts";
import { sameSite } from "../src/internal/sameSite.ts";

const SEED = 1337;
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

describe("nonce", () => {
  it("property: the nonce never repeats across 10,000 sim documents of different seeds, and is 64 hex characters", () => {
    const seen = new Set<string>();
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
        const n = nonceOf(createCtx({ mode: "sim", seed }));
        expect(n).toMatch(/^[0-9a-f]{64}$/);
        return true;
      }),
      { seed: SEED, numRuns: 200 },
    );
    for (let seed = 0; seed < 10_000; seed++) seen.add(nonceOf(createCtx({ mode: "sim", seed })));
    expect(seen.size).toBe(10_000);
  });

  it("documents of one app each carry a fresh nonce in the header, the module script and the meta", async () => {
    const app = await createApp({
      topology: topology({ web: { modules: ["a"], adapter: "node" } }),
      routes: manifest({ "a.home": { path: "/", component: () => document.createElement("main") } }),
      ctx: createCtx({ mode: "sim", seed: SEED }),
      mode: "production",
    });
    const nonces = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const res = await app.fetch(new Request("http://localhost/"));
      const n = /'nonce-([0-9a-f]{64})'/.exec(res.headers.get("content-security-policy") ?? "")?.[1] ?? "";
      expect(await res.text()).toContain(`<meta property="csp-nonce" nonce="${n}">`);
      nonces.add(n);
    }
    expect(nonces.size).toBe(50);
  });
});

describe("cspPolicy and securityHeaders", () => {
  it("the csp.txt policy has script-src 'self', no nonce or report directive, and each peer in connect-src", () => {
    const p = cspPolicy({ peers: ["https://api.test", "https://b.test"] });
    expect(p).toContain("script-src 'self';");
    expect(p).toContain("connect-src 'self' https://api.test https://b.test;");
    expect(p).not.toMatch(/nonce|report-|unsafe/);
    expect(cspPolicy({ peers: [] })).toContain("connect-src 'self';");
  });

  it("securityHeaders adds Strict-Transport-Security only for https", () => {
    expect(Object.keys(securityHeaders({ https: false }))).toHaveLength(6);
    expect(securityHeaders({ https: true })["strict-transport-security"]).toBe("max-age=63072000");
  });

  it("peersOfIndex reads keel-peer tags in order, once each, and nothing else", () => {
    const html =
      '<meta name="keel-peer" data-deployable="api" content="https://api.test"><meta name="x" content="https://no.test">' +
      '<meta content="https://b.test" name="keel-peer"><meta name="keel-peer" content="https://api.test">';
    expect(peersOfIndex(html)).toEqual(["https://api.test", "https://b.test"]);
  });

  it("a hosted client index.html carries the csp.txt policy with its keel-peer origins", async () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "keel-sec-host-"));
    dirs.push(d);
    const files: Record<string, string> = {
      ".vite/manifest.json": JSON.stringify({ e: { file: "assets/entry-abc12345.js", isEntry: true } }),
      "assets/entry-abc12345.js": "resume()",
      "index.html": '<!doctype html><meta name="keel-peer" data-deployable="api" content="https://api.test">',
    };
    for (const [rel, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
      fs.writeFileSync(path.join(d, rel), text);
    }
    const app = await createApp({
      topology: topology({
        api: { modules: ["a"], adapter: "node" },
        web: { modules: ["w"], adapter: "client", host: "api" },
      }),
      deployable: "api",
      routes: manifest({ "a.home": { path: "/", component: () => document.createElement("main") } }),
      ctx: createCtx({ mode: "sim", seed: SEED }),
      assets: d,
    });
    const res = await app.fetch(new Request("http://localhost/somewhere", { headers: { accept: "text/html" } }));
    expect(res.headers.get("content-security-policy")).toBe(cspPolicy({ peers: ["https://api.test"] }));
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });
});

describe("report endpoint", () => {
  const setup = async () => {
    const lines: string[] = [];
    const app = await createApp({
      topology: topology({ web: { modules: ["a"], adapter: "node" } }),
      routes: manifest({ "a.home": { path: "/", component: () => document.createElement("main") } }),
      ctx: createCtx({ mode: "sim", seed: SEED }),
      mode: "production",
      log: { format: "compact", write: (l) => lines.push(l) },
    });
    return { app, lines };
  };
  const post = (type: string, body: string) =>
    new Request("http://localhost/__keel/csp", { method: "POST", body, headers: { "content-type": type } });

  it("a GET is 405 and another media type is 415; neither logs a csp record", async () => {
    const { app, lines } = await setup();
    const get = await app.fetch(new Request("http://localhost/__keel/csp"));
    expect([get.status, get.headers.get("allow")]).toEqual([405, "POST"]);
    expect((await app.fetch(post("application/json", "{}"))).status).toBe(415);
    expect(lines.filter((l) => l.startsWith("csp "))).toEqual([]);
  });

  it("a reports+json body logs each csp-violation, skips other report types, and compact lines name no path", async () => {
    const { app, lines } = await setup();
    const v = (blockedURL: string) => ({
      type: "csp-violation",
      body: { documentURL: "http://localhost/?q=secret", effectiveDirective: "script-src-elem", blockedURL },
    });
    const body = JSON.stringify([v("inline"), { type: "deprecation", body: {} }, v("https://x.test/a.js")]);
    expect((await app.fetch(post("application/reports+json", body))).status).toBe(204);
    expect(lines.filter((l) => l.startsWith("csp "))).toEqual([
      "csp script-src-elem inline a.home",
      "csp script-src-elem https://x.test a.home",
    ]);
  });

  it("a directive over 64 characters is -, and blocked is at most 64 characters", async () => {
    const { app, lines } = await setup();
    const host = `${"h".repeat(80)}.test`;
    const body = JSON.stringify({
      "csp-report": {
        "document-uri": "http://localhost/",
        "violated-directive": "x".repeat(65),
        "blocked-uri": `https://${host}/a`,
      },
    });
    await app.fetch(post("application/csp-report", body));
    expect(lines.filter((l) => l.startsWith("csp "))).toEqual([`csp - ${`https://${host}`.slice(0, 64)} a.home`]);
  });

  it("a document is cache-control: private, no-store", async () => {
    const { app } = await setup();
    expect((await app.fetch(new Request("http://localhost/"))).headers.get("cache-control")).toBe("private, no-store");
  });

  it("an unparsable body answers 204 and logs nothing", async () => {
    const { app, lines } = await setup();
    expect((await app.fetch(post("application/csp-report", "{nope"))).status).toBe(204);
    expect(lines.filter((l) => l.startsWith("csp "))).toEqual([]);
  });

  it("blockedOf keeps keywords, reduces URLs to their origin, and says - for anything else", () => {
    expect(["eval", "wasm-eval", "trusted-types-sink", "https://a.test/p?q", "self", ""].map(blockedOf)).toEqual([
      "eval",
      "eval",
      "trusted-types",
      "https://a.test",
      "-",
      "-",
    ]);
  });
});

describe("same-site behind a TLS proxy", () => {
  const write = (headers: Record<string, string>) =>
    new Request("http://app.test/x", { method: "POST", headers: { origin: "https://app.test", ...headers } });

  it("an https Origin of the request's host passes when x-forwarded-proto is https, not otherwise", () => {
    expect(sameSite(write({ "x-forwarded-proto": "https" }), undefined)).toBe(true);
    expect(sameSite(write({}), undefined)).toBe(false);
    expect(sameSite(write({ "x-forwarded-proto": "http" }), undefined)).toBe(false);
    expect(sameSite(write({ "x-forwarded-proto": "https", origin: "https://evil.test" }), undefined)).toBe(false);
  });

  it("a write through createApp behind the proxy runs", async () => {
    const m = manifest({ "a.home": { path: "/", component: () => document.createElement("main") } });
    m.actions({ "a.home": { POST: action({ input: s.object({}) }, () => Promise.resolve(ok(null))) } });
    const app = await createApp({
      topology: topology({ web: { modules: ["a"], adapter: "node" } }),
      routes: m,
      ctx: createCtx({ mode: "sim", seed: SEED }),
      mode: "production",
    });
    const res = await app.fetch(
      new Request("http://app.test/", {
        method: "POST",
        body: "{}",
        headers: {
          origin: "https://app.test",
          "x-forwarded-proto": "https",
          "content-type": "application/json",
          accept: "application/json",
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("strict-transport-security")).toBe("max-age=63072000");
  });
});
