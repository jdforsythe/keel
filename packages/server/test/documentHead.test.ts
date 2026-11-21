// @vitest-environment happy-dom
// The document head (k.server Document): `<title>` the deployable name, the build's entry CSS and its `keel-mark.svg`
// icon, every value escaped; a `keel.notFound` default alert has an `h1`. Property seed 1337.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { err, s } from "@keel/schema";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import type { BuiltClient } from "../src/internal/BuiltClient.ts";
import { headHtml } from "../src/internal/headHtml.ts";
import { loadAssets } from "../src/internal/loadAssets.ts";

const SEED = 1337;
const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
const dir = (files: Record<string, string>): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "keel-head-"));
  made.push(d);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
    fs.writeFileSync(path.join(d, rel), text);
  }
  return d;
};
const MANIFEST = JSON.stringify({
  "entry.ts": {
    file: "assets/entry-B1x2Y3z4.js",
    isEntry: true,
    css: ["assets/entry-Ab12Cd34.css", "assets/gone.css"],
  },
});
const build = (): Record<string, string> => ({
  ".vite/manifest.json": MANIFEST,
  "assets/entry-B1x2Y3z4.js": "resume()",
  "assets/entry-Ab12Cd34.css": "b{}",
  "keel-mark.svg": "<svg/>",
  "robots.txt": "User-agent: *",
});
const built = (css: readonly string[], mark: boolean): BuiltClient => ({
  entry: "/assets/e.js",
  css,
  files: new Map(mark ? [["/keel-mark.svg", { body: new Uint8Array(0), type: "", immutable: false, etag: "" }]] : []),
});
/** The head of a document as text, cut at `</head>` so nothing in it is parsed or loaded. */
const headOf = (html: string): string => html.slice(html.indexOf("<head>"), html.indexOf("</head>"));

describe("headHtml", () => {
  it("titles the deployable and links each stylesheet, then the icon when the build has the mark", () => {
    expect(headHtml("web", undefined)).toBe("<title>web</title>");
    expect(headHtml("web", built(["/assets/a.css", "/assets/b.css"], true))).toBe(
      '<title>web</title><link rel="stylesheet" href="/assets/a.css"><link rel="stylesheet" href="/assets/b.css">' +
        '<link rel="icon" href="/keel-mark.svg">',
    );
    expect(headHtml("web", built([], false))).toBe("<title>web</title>");
  });

  it("property: any name or stylesheet URL is escaped, so the head holds exactly its own elements", () => {
    fc.assert(
      fc.property(fc.string(), fc.array(fc.string(), { maxLength: 3 }), (name, css) => {
        const head = headHtml(name, built(css, false));
        expect((head.match(/</g) ?? []).length).toBe(2 + css.length);
        expect((head.match(/"/g) ?? []).length).toBe(4 * css.length);
        const t = document.createElement("template");
        t.innerHTML = head;
        expect(t.content.querySelector("title")?.textContent).toBe(name);
        expect(Array.from(t.content.querySelectorAll("link"), (l) => l.getAttribute("href"))).toEqual(css);
      }),
      { seed: SEED },
    );
  });
});

describe("loadAssets", () => {
  it("serves the top-level keel-mark.svg and lists the entry chunk's CSS that the build holds", async () => {
    const b = await loadAssets(dir(build()));
    expect(b.css).toEqual(["/assets/entry-Ab12Cd34.css"]);
    expect(b.files.get("/keel-mark.svg")?.type).toBe("image/svg+xml");
    expect(b.files.has("/robots.txt")).toBe(false);
    expect(b.files.has("/.vite/manifest.json")).toBe(false);
  });

  it("links only manifest CSS that is a served .css file under /assets/", async () => {
    const css = [
      "keel-mark.svg",
      "assets/entry-B1x2Y3z4.js",
      "assets/../keel-mark.svg",
      "../x.css",
      "assets/entry-Ab12Cd34.css",
    ];
    const files = {
      ...build(),
      ".vite/manifest.json": JSON.stringify({ e: { file: "assets/entry-B1x2Y3z4.js", isEntry: true, css } }),
    };
    expect((await loadAssets(dir(files))).css).toEqual(["/assets/entry-Ab12Cd34.css"]);
  });

  it("property: any manifest css list links only escaped /assets/*.css hrefs the build serves", async () => {
    const pool = [
      "keel-mark.svg",
      "assets/a.css",
      'assets/q"x.css',
      "assets/x.js",
      "assets/../a.css",
      "../a.css",
      "/assets/a.css",
    ];
    const entry = fc.oneof(fc.constantFrom(...pool), fc.string(), fc.integer());
    await fc.assert(
      fc.asyncProperty(fc.array(entry, { maxLength: 5 }), async (css) => {
        const d = dir({
          ".vite/manifest.json": JSON.stringify({ e: { file: "assets/e.js", isEntry: true, css } }),
          "assets/e.js": "resume()",
          "assets/a.css": "a{}",
          'assets/q"x.css': "b{}",
          "assets/x.js": "x",
          "keel-mark.svg": "<svg/>",
        });
        const b = await loadAssets(d);
        for (const href of b.css) {
          expect(href).toMatch(/^\/assets\/[^/]+\.css$/);
          expect(b.files.has(href)).toBe(true);
        }
        const links = headHtml("web", b).match(/<link rel="stylesheet" href="[^"]*">/g) ?? [];
        expect(links).toHaveLength(b.css.length);
        for (const l of links) expect(l).not.toContain('q"x');
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("follows a symlinked assets/ directory, still refusing a file whose real path leaves it", async () => {
    const real = dir({ "e.js": "resume()", "secret.txt": "secret" });
    fs.mkdirSync(path.join(real, "assets"));
    fs.renameSync(path.join(real, "e.js"), path.join(real, "assets", "entry-B1x2Y3z4.js"));
    fs.symlinkSync(path.join(real, "secret.txt"), path.join(real, "assets", "leak.js"));
    const d = dir({ ".vite/manifest.json": MANIFEST });
    fs.symlinkSync(path.join(real, "assets"), path.join(d, "assets"));
    const b = await loadAssets(d);
    expect(b.entry).toBe("/assets/entry-B1x2Y3z4.js");
    expect(b.files.has("/assets/leak.js")).toBe(false);
  });

  it("reads no symlinked keel-mark.svg", async () => {
    const { "keel-mark.svg": _mark, ...rest } = build();
    const d = dir({ ...rest, "secret.svg": "secret" });
    fs.symlinkSync(path.join(d, "secret.svg"), path.join(d, "keel-mark.svg"));
    expect((await loadAssets(d)).files.has("/keel-mark.svg")).toBe(false);
  });
});

describe("createApp documents", () => {
  const routes = manifest({
    "app.home": { path: "/", component: () => document.createElement("p") },
    "app.item": {
      path: "/item",
      component: () => document.createElement("p"),
      loader: loader({ output: s.object({}) }, async () => err({ code: "keel.notFound", message: "gone", data: null })),
    },
  });
  const app = (assets?: string) =>
    createApp({
      topology: topology({ shop: { modules: ["app"], adapter: "node" } }),
      routes,
      ctx: createCtx({ mode: "sim", seed: SEED }),
      ...(assets === undefined ? { mode: "dev" } : { mode: "production", assets }),
    });

  it("a production document and a 404 carry the same head", async () => {
    const a = await app(dir(build()));
    const ok = await (await a.fetch(new Request("http://localhost/"))).text();
    const missing = await a.fetch(new Request("http://localhost/nope"));
    expect(missing.status).toBe(404);
    const head =
      '<title>shop</title><link rel="stylesheet" href="/assets/entry-Ab12Cd34.css"><link rel="icon" href="/keel-mark.svg">';
    expect(headOf(ok)).toContain(head);
    const body = await missing.text();
    expect(headOf(body)).toContain(head);
    expect(body).toContain('<div role="alert" data-keel-error="keel.notFound"><h1>Not found</h1></div>');
    const mark = await a.fetch(new Request("http://localhost/keel-mark.svg"));
    expect(mark.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await mark.text()).toBe("<svg/>");
  });

  it("a loader's keel.notFound without an errorElement gets the readable alert; dev has a title only", async () => {
    const a = await app();
    const res = await a.fetch(new Request("http://localhost/item"));
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(headOf(html)).toContain("<title>shop</title>");
    expect(headOf(html)).not.toContain("<link");
    expect(html).toContain("<h1>Not found</h1>");
  });
});
