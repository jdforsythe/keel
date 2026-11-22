// Spec: k.hosting, Conformance "`keel build` of a fixture whose topology is one `static` deployable `site` over a module with routes `/` and `/about`, each loader returning a text, exits 0 and writes `dist/site/index.html` and `dist/site/about/index.html` holding the texts, `dist/site/404.html`, `dist/site/csp.txt` and the files under `dist/site/assets/` those documents script; no `dist/index.html`."
// Spec: k.hosting, Static "`keel build` writes `dist/<name>/` per `static` deployable ... `index.html` for `/` and `<path>/index.html` otherwise; `404.html`, the not-found document; `assets/` with the resume entry of its islands; `keel-mark.svg`; `csp.txt` (k.security)."
// Seed: 1337 (no generated input: one fixture, one spawned build; see static-support.ts).
// ASSUMPTION: the fixture page has an event handler, so each route document is an island (k.runtime) and scripts the resume entry; "the files under assets/ those documents script" are the root-absolute `src` URLs of `<script>` tags, each read as `dist/site/<url>`.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { cleanup, keel, materialize, type Run } from "./compat-support.ts";
import { ABOUT_TEXT, HOME_TEXT, SLOW, staticTree } from "./static-support.ts";

let dir = "";
let run: Run | undefined;
beforeAll(() => {
  dir = materialize(staticTree());
}, SLOW);
afterAll(() => cleanup(dir));

const text = (rel: string): string => readFileSync(join(dir, "dist", "site", rel), "utf8");
const scripted = (html: string): string[] =>
  [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].flatMap((m) => (m[1] === undefined ? [] : [m[1]]));

test(
  "`keel build` of a fixture whose topology is one `static` deployable `site` over a module with routes `/` and `/about`, each loader returning a text, exits 0 and writes `dist/site/index.html` and `dist/site/about/index.html` holding the texts, `dist/site/404.html`, `dist/site/csp.txt` and the files under `dist/site/assets/` those documents script; no `dist/index.html`.",
  () => {
    run = keel(dir, ["build"]);
    expect(run.status).toBe(0);
    expect(text("index.html")).toContain(HOME_TEXT);
    expect(text("index.html")).not.toContain(ABOUT_TEXT);
    expect(text("about/index.html")).toContain(ABOUT_TEXT);
    expect(text("about/index.html")).not.toContain(HOME_TEXT);
    for (const f of ["404.html", "csp.txt", "keel-mark.svg"])
      expect(existsSync(join(dir, "dist", "site", f)), f).toBe(true);
    expect(readdirSync(join(dir, "dist", "site", "assets")).length).toBeGreaterThan(0);
    const urls = [...scripted(text("index.html")), ...scripted(text("about/index.html"))];
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u.startsWith("/assets/"), u).toBe(true);
      expect(existsSync(join(dir, "dist", "site", u)), u).toBe(true);
    }
    expect(existsSync(join(dir, "dist", "index.html"))).toBe(false);
  },
  SLOW,
);

test(
  "`404.html` is the not-found document: it holds neither route's text and carries an `h1` (k.head) and, with no island, loads no runtime JS (k.runtime).",
  () => {
    run ??= keel(dir, ["build"]);
    const nf = text("404.html");
    expect(nf).not.toContain(HOME_TEXT);
    expect(nf).not.toContain(ABOUT_TEXT);
    expect(nf).toContain("<h1");
    expect(nf).not.toContain('<script type="module"');
  },
  SLOW,
);
