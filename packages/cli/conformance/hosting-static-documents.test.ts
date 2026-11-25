// k.hosting, Static "**Static.** `keel build` writes `dist/<name>/` per `static` deployable: for each of its routes (one path each, E1553) the document its own `createApp` answers a GET of that path at build (production, a real `ctx` with memory storage, caller `''`; loaders run then), at `index.html` for `/` and `<path>/index.html` otherwise; `404.html`, the not-found document; `assets/` with the resume entry of its islands; `keel-mark.svg`; `csp.txt` (k.security). A route answering other than 200 fails the build (E1588). A static host returns `<path>/index.html` for `<path>` and `404.html` with 404 for a path that is no file, caching as above."
// Seed: 1337 (no generated input: one fixture with `styles`, one spawned build; the property over route sets is hosting-static-routes-property.test.ts).
// Untestable here: "A static host returns `<path>/index.html` for `<path>` and `404.html` with 404 for a path that is no file, caching as above" is the host's behaviour, not the build's.
// ASSUMPTIONS: the spec says a static route's document is what its `createApp` answers and never mentions `#app` (that is a `client` document), so "holds the page's rendered markup" is the loader's text appearing inside `<body>`; "links its styles" is each
// `<link rel="stylesheet">` href (root-absolute) naming a file under `dist/site/`, the fixture's topology listing `styles: ['@keel/ui/fonts']` (k.topology); the spec states no
// document for a route with a search schema, and none for trailing-slash paths: neither is asserted.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { cleanup, keel, materialize, type Run } from "./compat-support.ts";
import { ABOUT_TEXT, HOME_TEXT, SLOW, staticTree, stylesheetsOf } from "./static-support.ts";

const TOPOLOGY =
  "import { topology } from '@keel/server'\nexport default topology({ site: { modules: ['s'], adapter: 'static', styles: ['@keel/ui/fonts'] } })\n";
let dir = "";
let run: Run | undefined;
beforeAll(() => {
  dir = materialize(staticTree("none", TOPOLOGY));
}, SLOW);
afterAll(() => cleanup(dir));

const site = (rel: string): string => join(dir, "dist", "site", rel);
const text = (rel: string): string => readFileSync(site(rel), "utf8");
const built = (): Run => {
  run ??= keel(dir, ["build"]);
  return run;
};
const inBody = (html: string): string => /<body[^>]*>([\s\S]*?)<\/body>/.exec(html)?.[1] ?? "";
const scripts = (html: string): string[] =>
  [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].flatMap((m) => (m[1] === undefined ? [] : [m[1]]));

test(
  "for each route the document at `index.html` for `/` and `<path>/index.html` otherwise holds the page's rendered markup in its body, loaders having run at build",
  () => {
    expect(built().status).toBe(0);
    expect(inBody(text("index.html"))).toContain(HOME_TEXT);
    expect(inBody(text("about/index.html"))).toContain(ABOUT_TEXT);
    expect(inBody(text("index.html"))).not.toContain(ABOUT_TEXT);
  },
  SLOW,
);

test(
  "each route's document links its styles and scripts its resume entry, every file existing under `dist/site/`",
  () => {
    built();
    for (const doc of ["index.html", "about/index.html"]) {
      const html = text(doc);
      const css = stylesheetsOf(html);
      expect(css.length, doc).toBeGreaterThan(0);
      const js = scripts(html);
      expect(js.length, doc).toBeGreaterThan(0);
      for (const u of [...css, ...js]) {
        expect(u.startsWith("/assets/"), u).toBe(true);
        expect(existsSync(site(u)), u).toBe(true);
      }
    }
  },
  SLOW,
);

test(
  "`404.html`, `keel-mark.svg` and `csp.txt` are written beside the documents in `dist/site/`, and `csp.txt` is not written to `dist/`",
  () => {
    built();
    for (const f of ["404.html", "keel-mark.svg", "csp.txt"]) expect(existsSync(site(f)), f).toBe(true);
    expect(existsSync(join(dir, "dist", "csp.txt"))).toBe(false);
    expect(text("csp.txt")).toContain("script-src 'self'");
  },
  SLOW,
);
