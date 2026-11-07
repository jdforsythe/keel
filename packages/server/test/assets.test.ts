// A production client build (k.server Build, RFC 0048): loadAssets reads the manifest and assets/ once (E1555 when it
// cannot), createApp serves exactly those files immutable for GET/HEAD, and the dev entry is gone in production.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { afterEach, describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { loadAssets } from "../src/internal/loadAssets.ts";
import { servedEntry } from "../src/internal/servedEntry.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
const dir = (files: Record<string, string>): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "keel-assets-"));
  made.push(d);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
    fs.writeFileSync(path.join(d, rel), text);
  }
  return d;
};
const MANIFEST = JSON.stringify({
  "../x/@keel/entry.ts": { file: "assets/entry-abc.js", name: "entry", isEntry: true },
  _shared: { file: "assets/shared-def.js" },
});
const built = (): Record<string, string> => ({
  ".vite/manifest.json": MANIFEST,
  "assets/entry-abc.js": "import './shared-def.js';resume()",
  "assets/shared-def.js": "export const x=1",
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
      "/assets/entry-abc.js",
      "/assets/logo-2.svg",
      "/assets/shared-def.js",
      "/assets/sub/app-1.css",
    ]);
    expect(b.files.get("/assets/entry-abc.js")?.type).toBe("text/javascript; charset=utf-8");
    expect(b.files.get("/assets/sub/app-1.css")?.type).toBe("text/css; charset=utf-8");
    expect(b.files.get("/assets/logo-2.svg")?.type).toBe("image/svg+xml");
    expect(b.files.get("/assets/data-3.bin")?.type).toBe("application/octet-stream");
    expect(new TextDecoder().decode(b.files.get("/assets/shared-def.js")?.body)).toBe("export const x=1");
  });

  it("serves an entry outside assets/ when the manifest names one", async () => {
    const d = dir({
      ".vite/manifest.json": JSON.stringify({ e: { file: "entry.js", isEntry: true } }),
      "entry.js": "resume()",
    });
    const b = await loadAssets(d);
    expect(b.entry).toBe("/entry.js");
    expect([...b.files.keys()]).toEqual(["/entry.js"]);
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
  it("answers only GET and HEAD of a built file, immutable; HEAD has no body", async () => {
    const b = await loadAssets(dir(built()));
    const req = (method: string, p: string) => new Request(`http://localhost${p}`, { method });
    const get = servedEntry(req("GET", "/assets/shared-def.js"), "/assets/shared-def.js", b);
    expect(get?.response.status).toBe(200);
    expect(get?.response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(get?.response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(await get?.response.text()).toBe("export const x=1");
    const head = servedEntry(req("HEAD", "/assets/shared-def.js"), "/assets/shared-def.js", b);
    expect(head?.response.status).toBe(200);
    expect(await head?.response.text()).toBe("");
    expect(servedEntry(req("POST", "/assets/shared-def.js"), "/assets/shared-def.js", b)).toBeNull();
    expect(servedEntry(req("GET", "/assets/nope.js"), "/assets/nope.js", b)).toBeNull();
    expect(servedEntry(req("GET", "/index.html"), "/index.html", b)).toBeNull();
    expect(servedEntry(req("GET", "/@keel/entry.ts"), "/@keel/entry.ts", b)).toBeNull();
  });

  it("without a build serves only the dev entry, with no cache-control", () => {
    const r = servedEntry(new Request("http://localhost/@keel/entry.ts"), "/@keel/entry.ts", undefined);
    expect(r?.response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(r?.response.headers.get("cache-control")).toBeNull();
    expect(servedEntry(new Request("http://localhost/assets/x.js"), "/assets/x.js", undefined)).toBeNull();
  });
});

describe("createApp({ assets })", () => {
  const app = (assets: string, mode?: "dev" | "production") =>
    createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes: manifest({ "app.home": { path: "/", component: () => document.createElement("p") } }),
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
  });

  it("in dev ignores assets: no E1555, and the dev entry is served", async () => {
    const a = await app(dir({}), "dev");
    expect((await a.fetch(new Request("http://localhost/@keel/entry.ts"))).status).toBe(200);
    expect((await a.fetch(new Request("http://localhost/assets/entry-abc.js"))).status).toBe(404);
  });
});
