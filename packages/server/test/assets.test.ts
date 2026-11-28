// A production client build (k.server Build, RFC 0048, 0057): loadAssets reads the manifest and assets/ once (E1555 when
// it cannot), createApp serves exactly those files for GET/HEAD, nosniff, immutable only when the manifest names them
// hashed, never through a symlink out of assets/; the dev entry is gone in production.
import fs from "node:fs";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { loadAssets } from "../src/internal/loadAssets.ts";
import { servedEntry } from "../src/internal/servedEntry.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
const dir = (files: Record<string, string>): string => {
  const d = tempDir("keel-assets-");
  made.push(d);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
    fs.writeFileSync(path.join(d, rel), text);
  }
  return d;
};
const MANIFEST = JSON.stringify({
  "../x/@keel/entry.ts": {
    file: "assets/entry-abc.js",
    name: "entry",
    isEntry: true,
    css: ["assets/entry-C55a_b-9.css"],
  },
  _shared: { file: "assets/shared-De_f-123.js", assets: ["assets/font-0123abcd.woff2", 7] },
});
const built = (): Record<string, string> => ({
  ".vite/manifest.json": MANIFEST,
  "assets/entry-abc.js": "import './shared-De_f-123.js';resume()",
  "assets/entry-C55a_b-9.css": "b{}",
  "assets/font-0123abcd.woff2": "w",
  "assets/shared-De_f-123.js": "export const x=1",
  "assets/sub/app-1.css": "a{}",
  "assets/logo-2.svg": "<svg/>",
  "assets/data-3.bin": "x",
  "index.html": "<p>not served</p>",
});

describe("loadAssets", () => {
  it("keys the entry and every assets/ file by URL path with its content type", async () => {
    const b = await loadAssets(dir(built()));
    expect(b.entry).toBe("/assets/entry-abc.js");
    expect([...b.files.keys()].sort()).toEqual([
      "/assets/data-3.bin",
      "/assets/entry-C55a_b-9.css",
      "/assets/entry-abc.js",
      "/assets/font-0123abcd.woff2",
      "/assets/logo-2.svg",
      "/assets/shared-De_f-123.js",
      "/assets/sub/app-1.css",
    ]);
    expect(b.files.get("/assets/entry-abc.js")?.type).toBe("text/javascript; charset=utf-8");
    expect(b.files.get("/assets/sub/app-1.css")?.type).toBe("text/css; charset=utf-8");
    expect(b.files.get("/assets/logo-2.svg")?.type).toBe("image/svg+xml");
    expect(b.files.get("/assets/data-3.bin")?.type).toBe("application/octet-stream");
    expect(new TextDecoder().decode(b.files.get("/assets/shared-De_f-123.js")?.body)).toBe("export const x=1");
  });

  it("immutable only for a file the manifest names (file, css, assets) whose name carries a -<8+ char> hash", async () => {
    const b = await loadAssets(dir(built()));
    const immutable = [...b.files].filter(([, f]) => f.immutable).map(([k]) => k);
    // entry-abc.js is named but its "hash" is 3 characters; logo-2.svg and app-1.css are not named.
    expect(immutable.sort()).toEqual([
      "/assets/entry-C55a_b-9.css",
      "/assets/font-0123abcd.woff2",
      "/assets/shared-De_f-123.js",
    ]);
  });

  it("RFC 0057: an entry outside assets/ (or escaping the build) is not served: E1555", async () => {
    for (const file of ["entry.js", "../entry-AbCd1234.js", "assets/../entry-AbCd1234.js"]) {
      const d = dir({
        ".vite/manifest.json": JSON.stringify({ e: { file, isEntry: true } }),
        "entry.js": "resume()",
        "entry-AbCd1234.js": "resume()",
        "assets/x.js": "x",
      });
      await expect(loadAssets(d)).rejects.toThrow(`E1555 assets: .vite/manifest.json entry ${file} is missing`);
    }
  });

  it("backlog 0136: reads no symlink whose target is outside assets/, nor a symlinked directory; keeps one inside", async () => {
    const d = dir({ ...built(), "secret.txt": "top secret", "outside/deep.js": "deep secret" });
    fs.symlinkSync(path.join(d, "secret.txt"), path.join(d, "assets", "leak-AbCd1234.js"));
    fs.symlinkSync("../outside", path.join(d, "assets", "linked"));
    fs.symlinkSync("../index.html", path.join(d, "assets", "rel.html"));
    fs.symlinkSync("shared-De_f-123.js", path.join(d, "assets", "alias.js"));
    const b = await loadAssets(d);
    const keys = [...b.files.keys()];
    expect(keys).not.toContain("/assets/leak-AbCd1234.js");
    expect(keys).not.toContain("/assets/rel.html");
    expect(keys.some((k) => k.startsWith("/assets/linked"))).toBe(false);
    expect(keys).toContain("/assets/alias.js");
    for (const f of b.files.values()) expect(new TextDecoder().decode(f.body)).not.toContain("secret");
  });

  it("reads the build through a symlinked build directory (a release link)", async () => {
    const real = dir(built());
    const link = path.join(tempDir("keel-link-"), "current");
    made.push(path.dirname(link));
    fs.symlinkSync(real, link);
    expect((await loadAssets(link)).entry).toBe("/assets/entry-abc.js");
  });

  it("throws E1555 naming the manifest for a missing, non-JSON, entry-less, or dangling manifest", async () => {
    const cases: [Record<string, string>, string][] = [
      [{}, "is missing"],
      [{ ".vite/manifest.json": "{" }, "is not JSON"],
      [{ ".vite/manifest.json": "[1]" }, "has no entry chunk"],
      [{ ".vite/manifest.json": "null" }, "has no entry chunk"],
      [
        { ".vite/manifest.json": JSON.stringify({ a: { file: "a.js" }, b: { isEntry: true, file: 3 } }) },
        "has no entry chunk",
      ],
      [{ ".vite/manifest.json": MANIFEST }, "entry assets/entry-abc.js is missing"],
    ];
    for (const [files, why] of cases) {
      const d = dir(files);
      await expect(loadAssets(d)).rejects.toThrow(`E1555 assets: .vite/manifest.json ${why}; run \`keel build\``);
    }
  });
});

describe("servedEntry with a client build", () => {
  it("answers only GET and HEAD of a built file, nosniff, immutable when hashed and named; HEAD has no body", async () => {
    const b = await loadAssets(dir(built()));
    const req = (method: string, p: string) => new Request(`http://localhost${p}`, { method });
    const get = servedEntry(req("GET", "/assets/shared-De_f-123.js"), "/assets/shared-De_f-123.js", b);
    expect(get?.response.status).toBe(200);
    expect(get?.response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(get?.response.headers.get("x-content-type-options")).toBe("nosniff");
    const plain = servedEntry(req("GET", "/assets/logo-2.svg"), "/assets/logo-2.svg", b);
    expect(plain?.response.headers.get("cache-control")).toBe("no-cache");
    expect(plain?.response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(get?.response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(await get?.response.text()).toBe("export const x=1");
    const head = servedEntry(req("HEAD", "/assets/shared-De_f-123.js"), "/assets/shared-De_f-123.js", b);
    expect(head?.response.status).toBe(200);
    expect(await head?.response.text()).toBe("");
    expect(servedEntry(req("POST", "/assets/shared-De_f-123.js"), "/assets/shared-De_f-123.js", b)).toBeNull();
    expect(servedEntry(req("GET", "/assets/nope.js"), "/assets/nope.js", b)).toBeNull();
    expect(servedEntry(req("GET", "/index.html"), "/index.html", b)).toBeNull();
    expect(servedEntry(req("GET", "/@keel/entry.ts"), "/@keel/entry.ts", b)).toBeNull();
  });

  it("without a build serves only the dev entry, nosniff, with no cache-control", () => {
    const r = servedEntry(new Request("http://localhost/@keel/entry.ts"), "/@keel/entry.ts", undefined);
    expect(r?.response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(r?.response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r?.response.headers.get("cache-control")).toBeNull();
    expect(servedEntry(new Request("http://localhost/assets/x.js"), "/assets/x.js", undefined)).toBeNull();
  });
});

const home = contract("app", { "app.home": { path: "/" } });

describe("createApp({ assets })", () => {
  const app = (assets: string, mode?: "dev" | "production") =>
    createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes: manifest(home, { "app.home": { component: () => document.createElement("p") } }),
      ctx: createCtx({ mode: "sim", seed: 1337 }),
      assets,
      ...(mode === undefined ? {} : { mode }),
    });

  it("in production serves built files and leaves /@keel/entry.ts and unknown paths to the route table", async () => {
    const a = await app(dir(built()));
    const css = await a.fetch(new Request("http://localhost/assets/sub/app-1.css"));
    expect(css.status).toBe(200);
    expect(css.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect((await a.fetch(new Request("http://localhost/@keel/entry.ts"))).status).toBe(404);
    expect((await a.fetch(new Request("http://localhost/assets/missing.js"))).status).toBe(404);
    // A request path is only a key: `..` and its encodings normalize away before the lookup, and nothing is read.
    for (const p of ["/assets/../index.html", "/assets/%2e%2e/index.html", "/assets/..%2findex.html", "/index.html"]) {
      const r = await a.fetch(new Request(`http://localhost${p}`));
      expect(r.status).toBe(404);
      expect(await r.text()).not.toContain("not served");
    }
  });

  it("in dev ignores assets: no E1555, and the dev entry is served", async () => {
    const a = await app(dir({}), "dev");
    expect((await a.fetch(new Request("http://localhost/@keel/entry.ts"))).status).toBe(200);
    expect((await a.fetch(new Request("http://localhost/assets/entry-abc.js"))).status).toBe(404);
  });
});

describe("RFC 0057 amendment (backlog 0161)", () => {
  const req = (p: string, headers: Record<string, string> = {}) => new Request(`http://localhost${p}`, { headers });
  const fixture = () =>
    dir({
      ".vite/manifest.json": JSON.stringify({
        e: {
          file: "assets/entry-Ab12Cd34.js",
          isEntry: true,
          assets: ["assets/café-abcd1234.png", "assets/my logo-0f1e2d3c.svg"],
        },
        i: { file: "assets/island-checkout.js" },
        d: { file: "assets/plain-abcdefgh.js" },
        h: { file: "assets/dated-20241107.css" },
      }),
      "assets/entry-Ab12Cd34.js": "resume()",
      "assets/island-checkout.js": "island()",
      "assets/plain-abcdefgh.js": "p()",
      "assets/dated-20241107.css": "a{}",
      "assets/café-abcd1234.png": "png",
      "assets/my logo-0f1e2d3c.svg": "<svg/>",
    });

  it("backlog 0161: a manifest file whose name has no hash (island-checkout.js, plain-abcdefgh.js) is not immutable", async () => {
    const b = await loadAssets(fixture());
    const flag = (k: string) => b.files.get(k)?.immutable;
    expect(flag("/assets/island-checkout.js")).toBe(false);
    expect(flag("/assets/plain-abcdefgh.js")).toBe(false);
    expect(flag("/assets/entry-Ab12Cd34.js")).toBe(true);
    expect(flag("/assets/dated-20241107.css")).toBe(true);
    expect(flag("/assets/café-abcd1234.png")).toBe(true);
  });

  it("backlog 0161: a non-ASCII or spaced asset serves at its percent-encoded path; a malformed escape matches nothing", async () => {
    const b = await loadAssets(fixture());
    const cafe = servedEntry(req("/assets/caf%C3%A9-abcd1234.png"), "/assets/caf%C3%A9-abcd1234.png", b);
    expect(cafe?.response.status).toBe(200);
    expect(await cafe?.response.text()).toBe("png");
    const logo = servedEntry(req("/assets/my%20logo-0f1e2d3c.svg"), "/assets/my%20logo-0f1e2d3c.svg", b);
    expect(logo?.response.status).toBe(200);
    expect(servedEntry(req("/assets/caf%E9-abcd1234.png"), "/assets/caf%E9-abcd1234.png", b)).toBeNull();
    expect(servedEntry(req("/assets/%"), "/assets/%", b)).toBeNull();
  });

  it("backlog 0161: every built file has a weak ETag from its bytes; If-None-Match answers 304, nosniff, no body", async () => {
    const b = await loadAssets(fixture());
    const p = "/assets/island-checkout.js";
    const first = servedEntry(req(p), p, b);
    const etag = first?.response.headers.get("etag") ?? "";
    expect(etag).toMatch(/^W\/"[\w-]{22}"$/);
    expect(first?.response.headers.get("cache-control")).toBe("no-cache");
    for (const sent of [etag, etag.slice(2), `"x", ${etag}`, "*"]) {
      const again = servedEntry(req(p, { "if-none-match": sent }), p, b);
      expect(again?.response.status).toBe(304);
      expect(again?.response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(again?.response.headers.get("etag")).toBe(etag);
      expect(await again?.response.text()).toBe("");
    }
    const stale = servedEntry(req(p, { "if-none-match": 'W/"other"' }), p, b);
    expect(stale?.response.status).toBe(200);
    expect(await stale?.response.text()).toBe("island()");
    // Equal bytes, equal tag; different bytes, different tag.
    const other = servedEntry(req("/assets/plain-abcdefgh.js"), "/assets/plain-abcdefgh.js", b);
    expect(other?.response.headers.get("etag")).not.toBe(etag);
  });
});
