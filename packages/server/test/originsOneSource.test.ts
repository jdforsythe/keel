// @vitest-environment node
// k.origins, one declaration: the generated entries hand `createApp({ origins })` the static read's declaration, which
// replaces each deployable's runtime `origins`, so a spread the static read refuses (E1552) adds no origin to any
// policy; a `frame` origin that is the app's own is refused at startup (E1590) and left out of a document's
// `frame-src` (logged once in dev). Seed 1337.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Origins, parseTopology } from "@keel/compiler";
import { declaredOrigins } from "@keel/compiler/hosting/declaredOrigins";
import { topologyReadProblems } from "@keel/compiler/hosting/topologyReadProblems";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { cspPolicy } from "../src/csp/cspPolicy.ts";
import { createApp, topology } from "../src/index.ts";
import { declaredTopology } from "../src/internal/declaredTopology.ts";
import { framedApart } from "../src/internal/framedApart.ts";
import { ownFrame } from "../src/internal/ownFrame.ts";

const SEED = 1337;
const EVIL = "https://evil.example";
const routes = () => manifest({ "a.home": { path: "/", component: () => document.createElement("main") } });
const ctx = () => createCtx({ mode: "sim", seed: SEED });
const policyOf = (res: Response): string =>
  res.headers.get("content-security-policy") ?? res.headers.get("content-security-policy-report-only") ?? "";
const doc = (url = "http://localhost/") => new Request(url, { headers: { accept: "text/html" } });

/** The spread form red-teamed in D66, as `topology.ts` source and as the value it evaluates to. */
const SPREAD = `import { topology } from "@keel/server";\nexport default topology({ web: { modules: ['a'], adapter: 'node', ...{ origins: { connect: { '${EVIL}': 'x' } } } } });\n`;
const TWICE = `export default topology({ web: { modules: ['a'], adapter: 'node', origins: {}, origins: { connect: { '${EVIL}': 'x' } } } });\n`;
const RUNTIME = topology({ web: { modules: ["a"], adapter: "node", ...{ origins: { connect: { [EVIL]: "x" } } } } });

describe("one declaration for every policy", () => {
  it("a spread or a second `origins` in a deployable is E1552 and leaves the static read without the origin", () => {
    for (const source of [SPREAD, TWICE]) {
      expect(topologyReadProblems(source).map(([c]) => c)).toEqual(["E1552"]);
      expect(parseTopology(source).topology.web?.origins).toBeUndefined();
      expect(declaredOrigins(source).origins).toEqual({});
    }
  });

  it("the spread form yields no origin in any emitted policy: document, dev document, csp.txt and shell text", async () => {
    const read = Object.fromEntries(
      Object.entries(parseTopology(SPREAD).topology).flatMap(([n, d]) =>
        d.origins === undefined ? [] : [[n, d.origins]],
      ),
    );
    expect(RUNTIME.web?.origins?.connect?.[EVIL]).toBe("x");
    for (const mode of ["production", "dev"] as const) {
      const app = await createApp({ topology: RUNTIME, origins: read, routes: routes(), ctx: ctx(), mode });
      expect(policyOf(await app.fetch(doc()))).not.toContain(EVIL);
      await app.close();
    }
    // csp.txt, the shells and security.json read `declaredOrigins(source)`, the same read.
    const text = cspPolicy({ peers: [], origins: declaredOrigins(SPREAD).origins.web });
    expect(text).not.toContain(EVIL);
    expect(text).toBe(cspPolicy({ peers: [] }));
  });

  it("without `origins` (a test's createApp) the topology's own declaration is read", async () => {
    const app = await createApp({ topology: RUNTIME, routes: routes(), ctx: ctx() });
    expect(policyOf(await app.fetch(doc()))).toContain(`connect-src 'self' ${EVIL}`);
    await app.close();
  });

  it("declaredTopology replaces every deployable's origins by the given ones, none for an absent entry", () => {
    const origin = fc.stringMatching(/^[a-z]{1,8}$/).map((h) => `https://${h}.example`);
    fc.assert(
      fc.property(
        fc.dictionary(origin, fc.constant("r"), { maxKeys: 4 }),
        fc.dictionary(origin, fc.constant("r"), { maxKeys: 4 }),
        fc.boolean(),
        (runtime, declared, given) => {
          const top = { web: { modules: ["a"], adapter: "node" as const, origins: { connect: runtime } } };
          const read: Record<string, Origins> = given ? { web: { img: declared } } : {};
          const out = declaredTopology(top, read);
          expect(out.web?.origins).toEqual(given ? { img: declared } : undefined);
          expect(out.web?.modules).toEqual(["a"]);
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });
});

describe("a frame of the app's own origin", () => {
  const made: string[] = [];
  afterEach(() => {
    for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });
  const built = (): string => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "keel-own-frame-"));
    made.push(d);
    const files: Record<string, string> = {
      ".vite/manifest.json": JSON.stringify({ e: { file: "assets/entry-abc12345.js", isEntry: true } }),
      "assets/entry-abc12345.js": "mount()",
      "index.html": "<!doctype html><title>web</title>",
    };
    for (const [rel, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
      fs.writeFileSync(path.join(d, rel), text);
    }
    return d;
  };

  it("rejects with E1590 when the served deployable frames `origin` or a URL peer's origin", async () => {
    const frames = (o: string) =>
      topology({
        web: { modules: ["a"], adapter: "node", origins: { frame: { [o]: "r" } } },
        api: { modules: ["b"], adapter: "node" },
      });
    await expect(
      createApp({
        topology: frames("https://shop.example"),
        deployable: "web",
        origin: "https://shop.example",
        routes: routes(),
        ctx: ctx(),
      }),
    ).rejects.toThrow(/^E1590 web: origins\.frame: https:\/\/shop\.example is the app's own origin/);
    await expect(
      createApp({
        topology: frames("https://api.example"),
        deployable: "web",
        peers: { api: "https://api.example/" },
        routes: routes(),
        ctx: ctx(),
      }),
    ).rejects.toThrow(/^E1590 web: origins\.frame: https:\/\/api\.example/);
    const other = await createApp({
      topology: frames("https://video.example"),
      deployable: "web",
      origin: "https://shop.example",
      routes: routes(),
      ctx: ctx(),
    });
    await other.close();
  });

  it("rejects with E1590 when the `client` it hosts frames the host's `origin`", async () => {
    const hosted = topology({
      api: { modules: ["a"], adapter: "node" },
      web: { modules: ["w"], adapter: "client", host: "api", origins: { frame: { "https://shop.example": "r" } } },
    });
    await expect(
      createApp({
        topology: hosted,
        deployable: "api",
        origin: "https://shop.example",
        routes: routes(),
        ctx: ctx(),
        assets: built(),
      }),
    ).rejects.toThrow(/^E1590 web: origins\.frame: https:\/\/shop\.example/);
  });

  it("a dev document leaves its own origin out of `frame-src` and logs one E1590", async () => {
    const lines: string[] = [];
    const app = await createApp({
      topology: topology({
        web: {
          modules: ["a"],
          adapter: "node",
          origins: { frame: { "http://localhost:5173": "r", "https://v.example": "r" } },
        },
      }),
      routes: routes(),
      ctx: ctx(),
      mode: "dev",
      log: { format: "compact", write: (l) => lines.push(l) },
    });
    for (let i = 0; i < 2; i++) {
      const policy = policyOf(await app.fetch(doc("http://localhost:5173/")));
      expect(policy).toContain("frame-src https://v.example;");
    }
    expect(policyOf(await app.fetch(doc("http://localhost:4000/")))).toContain(
      "frame-src http://localhost:5173 https://v.example;",
    );
    expect(lines.filter((l) => l.includes("E1590"))).toHaveLength(1);
    await app.close();
  });

  it("ownFrame and framedApart: a frame origin in the own set is found and removed, others kept in order", () => {
    const origin = fc.stringMatching(/^[a-z]{1,8}$/).map((h) => `https://${h}.example`);
    fc.assert(
      fc.property(fc.uniqueArray(origin, { minLength: 1, maxLength: 6 }), fc.nat(5), (list, i) => {
        const own = list[i % list.length] ?? "";
        const origins: Origins = { frame: Object.fromEntries(list.map((o) => [o, "r"])) };
        expect(ownFrame(origins, new Set([own]))).toBe(own);
        expect(Object.keys(framedApart(origins, own)?.frame ?? {})).toEqual(list.filter((o) => o !== own));
        expect(framedApart(origins, "https://none.test")).toBe(origins);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});
