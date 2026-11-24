// @vitest-environment happy-dom
// Client hosting in the compiler (k.hosting): `originOf` accepts exactly http(s) origins, `peerOrigins` turns
// `KEEL_PEER_<NAME>` into tags (E1565 keys, never values), `servedByProblems` finds every E1566 arm, `parseTopology` reads
// `servedBy`, the client entry binds the `keel-peer` tags, and the Vite plugin builds a `client` deployable into
// `dist/<name>/` with a default `index.html`, the peer tags and the mark, then copies it into what serves it. Seed 1337.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { repoRoot } from "@keel/tooling/repo-root";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { originOf } from "../src/hosting/originOf.ts";
import { peerOrigins } from "../src/hosting/peerOrigins.ts";
import { servedByProblems } from "../src/hosting/servedByProblems.ts";
import { topologyReadProblems } from "../src/hosting/topologyReadProblems.ts";
import { entryCode } from "../src/internal/entryCode.ts";
import { hostClient } from "../src/internal/hostClient.ts";
import { indexHtml } from "../src/internal/indexHtml.ts";
import { keelMark } from "../src/internal/keelMark.ts";
import { parseTopology } from "../src/internal/parseTopology.ts";
import keel from "../src/vite.ts";

/** What the plugin's `config` always gives: the locked `envPrefix` and the worker bundles' plugin. */
const SERVE = { envPrefix: "\0", worker: { plugins: expect.any(Function) } };
/** A build defines `DEV` and `PROD` itself, whatever the project config sets `process.env.NODE_ENV` to. */
const OWN = { ...SERVE, define: { "import.meta.env.DEV": "false", "import.meta.env.PROD": "true" } };

const SEED = 1337;
const host = fc.stringMatching(/^[a-z]([a-z0-9-]{0,9}[a-z0-9])?(\.[a-z]([a-z0-9-]{0,5}[a-z0-9])?){0,2}$/);
const port = fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined });

describe("originOf", () => {
  it("maps any http(s) origin to its serialization, idempotently", () => {
    fc.assert(
      fc.property(fc.constantFrom("http", "https", "HTTPS"), host, port, fc.boolean(), (scheme, h, p, slash) => {
        const v = `${scheme}://${h.toUpperCase()}${p === undefined ? "" : `:${p}`}${slash ? "/" : ""}`;
        const o = originOf(v);
        expect(o).toBe(new URL(v).origin);
        expect(o === undefined ? undefined : originOf(o)).toBe(o);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("refuses paths, queries, fragments, credentials, wildcards, whitespace and other schemes", () => {
    const bad = fc.oneof(
      fc.constantFrom(
        "*",
        "null",
        "",
        "app.test",
        "//app.test",
        "https://*.app.test",
        "https://app.test/x",
        "https://app.test//",
        "https://app.test/.",
        "https://app.test?",
        "https://app.test#",
        "https://u@app.test",
        " https://app.test",
        "https://app.test ",
        "https:\\\\app.test",
        "ftp://app.test",
        "file:///x",
        "data:text/plain,x",
      ),
      fc.tuple(host, fc.stringMatching(/^\/[a-z]{1,5}$/)).map(([h, p]) => `https://${h}${p}`),
    );
    fc.assert(
      fc.property(bad, (v) => {
        expect(originOf(v)).toBeUndefined();
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});

describe("originOf hosts", () => {
  const unsafe = /["'<>\s]/;
  it("refuses a host outside DNS, IPv4 or bracketed IPv6 syntax", () => {
    for (const v of [
      'https://a".test',
      "https://a%22.test",
      "https://a'.test",
      "https://a<b.test",
      "https://a%3E.test",
      "https://a_b.test",
      "https://-a.test",
      "https://a-.test",
      "https://a..test",
      "https://a.test.",
      "https://a%20b.test",
      "https://a$.test",
    ])
      expect(originOf(v), v).toBeUndefined();
    for (const v of [
      "https://xn--bcher-kva.test",
      "http://127.0.0.1:3000",
      "http://[::1]:3000",
      "https://[2001:db8::1]",
    ])
      expect(originOf(v), v).toBe(new URL(v).origin);
  });

  it("every accepted value round-trips through new URL(v).origin and holds no quote, angle bracket or space", () => {
    const ch = fc.constantFrom(..."abz09-.\"'<>%_:[]@ \t".split(""), "%22", "%3c", "%20", "xn--");
    const raw = fc.array(ch, { minLength: 1, maxLength: 12 }).map((cs) => cs.join(""));
    fc.assert(
      fc.property(fc.constantFrom("http", "https"), raw, port, (scheme, h, p) => {
        const o = originOf(`${scheme}://${h}${p === undefined ? "" : `:${p}`}`);
        if (o === undefined) return;
        expect(new URL(o).origin).toBe(o);
        expect(unsafe.test(o)).toBe(false);
      }),
      { seed: SEED, numRuns: 2000 },
    );
  });
});

describe("peerOrigins", () => {
  const top = {
    api: { modules: ["a"], adapter: "node" },
    jobs: { modules: ["j"], adapter: "node" },
    web: { modules: ["w"], adapter: "client" },
  } as const;
  it("tags each node deployable whose key is set, by name, as an origin", () => {
    const r = peerOrigins(top, {
      KEEL_PEER_JOBS: "https://jobs.test/",
      KEEL_PEER_API: "http://API.test:8080",
      KEEL_PEER_WEB: "x",
    });
    expect(r).toEqual({
      origins: [
        ["api", "http://api.test:8080"],
        ["jobs", "https://jobs.test"],
      ],
      bad: [],
    });
  });
  it("names the key of a value that is not an origin, never the value", () => {
    const r = peerOrigins(top, { KEEL_PEER_API: "nope", KEEL_PEER_JOBS: "https://jobs.test/v1" });
    expect(r.bad).toEqual(["KEEL_PEER_API", "KEEL_PEER_JOBS"]);
    expect(JSON.stringify(r)).not.toContain("nope");
  });
});

describe("servedByProblems", () => {
  const n = { modules: ["a"], adapter: "node" } as const;
  it("is empty for a client naming a node deployable, or no servedBy", () => {
    expect(servedByProblems({ api: n, web: { modules: ["w"], adapter: "client", servedBy: "api" } })).toEqual([]);
    expect(servedByProblems({ api: n })).toEqual([]);
  });
  it("reports each arm once, by deployable", () => {
    expect(
      servedByProblems({
        api: { ...n, servedBy: "api" },
        one: { modules: ["o"], adapter: "client", servedBy: "api" },
        two: { modules: ["t"], adapter: "client", servedBy: "api" },
        three: { modules: ["x"], adapter: "client", servedBy: "nowhere" },
        four: { modules: ["y"], adapter: "client", servedBy: "one" },
        pre: { modules: ["p"], adapter: "static", servedBy: "api" },
      }).map(([name]) => name),
    ).toEqual(["api", "four", "pre", "three", "two"]);
  });
});

describe("parseTopology servedBy", () => {
  it("reads a literal servedBy and omits an absent one", () => {
    const { topology } = parseTopology(
      `export default topology({ web: { modules: ["w"], adapter: "client", servedBy: "api" }, api: { modules: ["a"], adapter: "node" } })`,
    );
    expect(topology.web).toEqual({ modules: ["w"], adapter: "client", servedBy: "api" });
    expect(topology.api).toEqual({ modules: ["a"], adapter: "node" });
  });

  it("reports a key a deployable does not list, a leftover host included, as E1552 and keeps the rest", () => {
    const source = `export default topology({ web: { modules: ["w"], adapter: "client", host: "api" }, api: { modules: ["a"], adapter: "node", caller: { days: 3 } } })`;
    expect(parseTopology(source).problems).toEqual([["web", "web: host is not a deployable key"]]);
    expect(topologyReadProblems(source).map(([code]) => code)).toEqual(["E1552"]);
  });

  it("reports a servedBy that is not a string literal, as topologyReadProblems does from the source, as E1566", () => {
    for (const h of ["`api`", "API", '"a" + "pi"', "`${API}`"]) {
      const source = `const API = "api";\nexport default topology({ api: { modules: ["a"], adapter: "node" }, web: { modules: ["w"], adapter: "client", servedBy: ${h} } })`;
      const r = parseTopology(source);
      expect(r.problems, h).toEqual([["web", "web: servedBy must be a string literal"]]);
      expect(r.topology.web).toEqual({ modules: ["w"], adapter: "client" });
      expect(topologyReadProblems(source)).toEqual([["E1566", "web", "web: servedBy must be a string literal"]]);
      expect(servedByProblems(r.topology)).toEqual([]);
    }
  });
});

describe("client entry peers", () => {
  const bind = (deployables: Record<string, readonly string[]>): string =>
    entryCode([], "x.css", {}, deployables)
      .split("\n")
      .filter((l) => /__keel(?:Tags|Key|Table)/.test(l))
      .join("\n");
  it("binds each module to its deployable's keel-peer origin, else the document's", () => {
    document.head.innerHTML = '<meta name="keel-peer" data-deployable="api" content="https://api.test">';
    const ctx = createCtx({ mode: "sim", seed: SEED });
    new Function("ctx", bind({ api: ["a", "b"], web: ["w"] }))(ctx);
    const table: unknown = Reflect.get(globalThis, Symbol.for("keel.modules"));
    const map: unknown = table instanceof WeakMap ? table.get(ctx) : undefined;
    expect(map instanceof Map ? Object.fromEntries(map) : undefined).toEqual({
      a: "https://api.test",
      b: "https://api.test",
      w: location.origin,
    });
  });
  it("emits no binding without deployables", () => {
    expect(entryCode([], "x.css")).not.toContain("keel-peer");
  });
});

describe("client build", () => {
  const made: string[] = [];
  const saved = { ...process.env };
  afterEach(() => {
    for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
    for (const k of ["KEEL_DEPLOYABLE", "KEEL_PEER_API"]) {
      const v = saved[k];
      if (v === undefined) Reflect.deleteProperty(process.env, k);
      else process.env[k] = v;
    }
  });
  const project = (top: string): string => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "keel-client-"));
    made.push(d);
    fs.writeFileSync(path.join(d, "topology.ts"), `export default topology(${top})\n`);
    return d;
  };
  const TOP = `{ api: { modules: ["a"], adapter: "node" }, web: { modules: ["w"], adapter: "client", servedBy: "api" } }`;

  it("serves the generated index.html, never the project's own, with the peer tags", async () => {
    const root = project(TOP);
    process.env.KEEL_DEPLOYABLE = "web";
    process.env.KEEL_PEER_API = "https://api.test/";
    const p = keel();
    expect(p.config({ root }, { command: "build" })).toEqual({
      ...OWN,
      build: { outDir: "dist/web", emptyOutDir: true },
    });
    p.configResolved({ root, command: "build" });
    const index = path.join(root, "index.html");
    expect(p.resolveId(index)).toBe(index);
    expect(await p.load(index)).toBe(indexHtml("web", "/@keel/entry.ts"));
    expect(p.transformIndexHtml()).toEqual([
      {
        tag: "meta",
        attrs: { name: "keel-peer", "data-deployable": "api", content: "https://api.test" },
        injectTo: "head",
      },
    ]);
    // A project's own index.html is never read (k.head Document source).
    fs.writeFileSync(index, "<p>own</p>");
    expect(p.resolveId(index)).toBe(index);
    expect(await p.load(index)).toBe(indexHtml("web", "/@keel/entry.ts"));
    process.env.KEEL_PEER_API = "nope";
    expect(() => p.transformIndexHtml()).toThrow(/^E1565 KEEL_PEER_API is not an http\(s\) origin/);
  });

  it("writes the mark when public/ has none, and keeps one it has", () => {
    const root = project(TOP);
    process.env.KEEL_DEPLOYABLE = "web";
    const p = keel();
    p.config({ root }, { command: "build" });
    p.configResolved({ root, command: "build" });
    fs.mkdirSync(path.join(root, "dist", "web"), { recursive: true });
    p.closeBundle();
    expect(fs.readFileSync(path.join(root, "dist", "web", "keel-mark.svg"), "utf8")).toBe(keelMark());
    fs.writeFileSync(path.join(root, "dist", "web", "keel-mark.svg"), "<svg/>");
    p.closeBundle();
    expect(fs.readFileSync(path.join(root, "dist", "web", "keel-mark.svg"), "utf8")).toBe("<svg/>");
  });

  it("adds no tags and writes no mark outside a client build", () => {
    const root = project(TOP);
    process.env.KEEL_DEPLOYABLE = "api";
    const p = keel();
    p.configResolved({ root, command: "build" });
    expect(p.transformIndexHtml()).toEqual([]);
    p.closeBundle();
    expect(fs.existsSync(path.join(root, "dist"))).toBe(false);
  });

  it("the mark is the brand mark", () => {
    const brand = path.join(repoRoot(import.meta.dirname), "docs", "brand", "keel-mark.svg");
    expect(keelMark()).toBe(fs.readFileSync(brand, "utf8").replace(/\n?$/, "\n"));
  });
});

describe("hostClient", () => {
  it("copies the client build without overwriting the host's files and records its assets", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "keel-hostclient-"));
    try {
      const put = (rel: string, text: string): void => {
        fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
        fs.writeFileSync(path.join(d, rel), text);
      };
      put("web/index.html", "<p>web</p>");
      put("web/keel-mark.svg", "client");
      put("web/assets/index-abc12345.js", "c");
      put("web/assets/sub/x-def67890.css", "s");
      put("api/keel-mark.svg", "host");
      put("api/.vite/manifest.json", JSON.stringify({ e: { file: "assets/entry-1.js", isEntry: true } }));
      hostClient(path.join(d, "web"), path.join(d, "api"), "web");
      expect(fs.readFileSync(path.join(d, "api", "index.html"), "utf8")).toBe("<p>web</p>");
      expect(fs.readFileSync(path.join(d, "api", "keel-mark.svg"), "utf8")).toBe("host");
      const m: unknown = JSON.parse(fs.readFileSync(path.join(d, "api", ".vite", "manifest.json"), "utf8"));
      expect(m).toEqual({
        e: { file: "assets/entry-1.js", isEntry: true },
        "keel:servedBy": { file: "index.html", assets: ["assets/index-abc12345.js", "assets/sub/x-def67890.css"] },
      });
      expect(() => hostClient(path.join(d, "none"), path.join(d, "api"), "none")).toThrow(/dist\/none\/index.html/);
    } finally {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });
});
