// Seed 1337 (no generated input: one fixture per variant, spawned builds). `keel build` of a `static` deployable
// (k.hosting Static) over an app that passes `keel check`: a prerendered document per route in `dist/<name>/`, the
// not-found document, the islands' resume entry, the mark and the policy, nothing in `dist/` itself; a route whose
// build GET answers other than 200 is one E1588 naming the route id and the status.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, expect, test } from "vitest";
import { type Tree, cleanup, diags, keel, materialize } from "../conformance/compat-support.ts";

const SLOW = fixedTime(300_000);
const HOME_TEXT = "HOME-TEXT-1337";
const ABOUT_TEXT = "ABOUT-TEXT-1337";
type Failing = "none" | "notFound" | "denied" | "throws";

/** One loader file: `ok({ text })`, or `err` of `keel.notFound`, or a throw that is no `throw` statement (E1451 forbids one in app code). */
const loaderSrc = (name: string, id: string, text: string, how: Failing): string => {
  const body =
    how === "notFound"
      ? "err(keelError.notFound.make({}))"
      : how === "throws"
        ? "ok({ text: JSON.parse('{').text })"
        : `ok({ text: '${text}' })`;
  return `import { loader } from '@keel/router'\nimport { ${how === "notFound" ? "err, keelError" : "ok"} } from '@keel/schema'\nimport { Out } from './Out.schema.ts'\nimport { s } from './s.contract.ts'\n\nexport const ${name} = loader(s, '${id}', { output: Out }, async () => ${body})\n`;
};

/**
 * A project whose deployable `site` has adapter `static` over module `s`; `failing` breaks `/about`.
 * The app passes `keel check`: contract export `s`, one export per file, schemas in `*.schema.ts`, a page guard with
 * `redirect`. The page has an event handler, so each document is an island and scripts the resume entry (k.runtime).
 */
function staticTree(failing: Failing = "none"): Tree {
  const about: Failing = failing === "notFound" || failing === "throws" ? failing : "none";
  return {
    "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0" })}\n`,
    "vite.config.ts":
      'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
    "tsconfig.json": JSON.stringify({
      compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
    }),
    "topology.ts":
      "import { topology } from '@keel/server'\nexport default topology({ site: { modules: ['s'], adapter: 'static' } })\n",
    "modules/s/module.ts":
      "import { module } from '@keel/compiler'\nexport default module({ id: 's', deps: [], capabilities: [], public: { exports: [] } })\n",
    "modules/s/s.contract.ts":
      "import { contract } from '@keel/router/contract'\nexport const s = contract('s', { 's.home': { path: '/' }, 's.about': { path: '/about' } })\n",
    "modules/s/Out.schema.ts": "import { s } from '@keel/schema'\nexport const Out = s.object({ text: s.string() })\n",
    "modules/s/home.server.ts": loaderSrc("home", "s.home", HOME_TEXT, "none"),
    "modules/s/about.server.ts": loaderSrc("about", "s.about", ABOUT_TEXT, about),
    "modules/s/deny.guard.ts":
      "import { guard } from '@keel/router'\nimport { err, keelError, ok } from '@keel/schema'\n" +
      "export const deny = guard({ redirect: 's.home' }, async ({ user }) => (user === '' ? err(keelError.denied.make({})) : ok(null)))\n",
    "modules/s/Page.tsx":
      "import { Box, Button, Text } from '@keel/ui'\nexport default function Page(props: { data: { text: string } }) {\n  return (\n" +
      '    <Box id="s.page">\n      <Text id="s.page.text">{props.data.text}</Text>\n      <Button id="s.page.more" onClick={() => undefined}>More</Button>\n    </Box>\n  )\n}\n',
    "modules/s/routes.ts": `import { manifest } from '@keel/router'\nimport Page from './Page.tsx'\nimport { about } from './about.server.ts'\nimport { deny } from './deny.guard.ts'\nimport { home } from './home.server.ts'\nimport { s } from './s.contract.ts'\nexport const routes = manifest(s, { 's.home': { component: Page, loader: home }, 's.about': { component: Page, loader: about${failing === "denied" ? ", guard: deny" : ""} } })\n`,
  };
}

const dirs = new Map<Failing, string>();
const variants: readonly Failing[] = ["none", "notFound", "denied", "throws"];
beforeAll(() => {
  for (const v of variants) dirs.set(v, materialize(staticTree(v)));
}, SLOW);
afterAll(() => {
  for (const d of dirs.values()) cleanup(d);
});
const dirOf = (v: Failing): string => dirs.get(v) ?? "";
const site = (rel: string): string => join(dirOf("none"), "dist", "site", rel);
const scripted = (html: string): string[] =>
  [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].flatMap((m) => (m[1] === undefined ? [] : [m[1]]));

test(
  "writes each route's document, 404.html, the scripted assets, the mark and csp.txt under dist/site/, and no dist/index.html",
  () => {
    const r = keel(dirOf("none"), ["build"]);
    expect(r.status).toBe(0);
    const home = readFileSync(site("index.html"), "utf8");
    const about = readFileSync(site("about/index.html"), "utf8");
    expect(home).toContain(HOME_TEXT);
    expect(home).not.toContain(ABOUT_TEXT);
    expect(about).toContain(ABOUT_TEXT);
    const nf = readFileSync(site("404.html"), "utf8");
    expect(nf).not.toContain(HOME_TEXT);
    expect(nf).toContain("<h1");
    for (const f of ["csp.txt", "keel-mark.svg"]) expect(existsSync(site(f)), f).toBe(true);
    const urls = [...scripted(home), ...scripted(about)];
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u.startsWith("/assets/"), u).toBe(true);
      expect(existsSync(site(u)), u).toBe(true);
    }
    // A file host serves no policy header: no document carries a nonce, and the Vite manifest is not shipped.
    expect(home).not.toContain("nonce");
    expect(existsSync(site(".vite"))).toBe(false);
    expect(existsSync(join(dirOf("none"), "dist", "index.html"))).toBe(false);
  },
  SLOW,
);

test.each(["notFound", "denied", "throws"] as const)(
  "a route whose build GET answers other than 200 (%s) is one E1588 naming the route id and status, exit 1",
  (v) => {
    const r = keel(dirOf(v), ["build"]);
    expect(r.status).toBe(1);
    const d = diags(r, "E1588");
    expect(d).toHaveLength(1);
    const m = String(d[0]?.message);
    expect(m).toContain("s.about");
    expect(m).toMatch(v === "notFound" ? /\b404\b/ : v === "throws" ? /\b500\b/ : /\b30[23]\b/);
  },
  SLOW,
);
