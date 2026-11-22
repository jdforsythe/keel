// Spec: k.head, Conformance "With a project `index.html` holding `<header>Only here</header>`, neither `keel dev`'s nor the built `dist/web/index.html` of `client` deployable `web` holds that text, the built one's `<title>` is `web`, and `keel check` prints one W1012 naming `index.html`; without the file, none."
// Spec: k.head, Rules "W1012 a project root holding `index.html`, once per `keel check`, `keel dev` and `keel build`, naming it (fix: move markup into a layout, stylesheets into `styles`)."
// Spec: k.head, Document source "A project's own `index.html` is never read."
// Seed: 1337 (no generated input: one fixture per variant, spawned). Pending: the project `index.html` is still read and W1012 is not reported.
// ASSUMPTION: the diagnostic is a `diag` record of the json stream whose `path` or `message` holds `index.html`; a dev document is a GET of `/` with `accept: text/html`.
import { existsSync } from "node:fs";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { cleanup, diags, keel, materialize, readText } from "./compat-support.ts";
import { SLOW, freePort, get, served, startDev, staticTree, stop, stopAll } from "./static-support.ts";

const ONLY = "<header>Only here</header>";
const INDEX = `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>fx</title>\n  </head>\n  <body>\n    ${ONLY}\n    <div id="app"></div>\n    <script type="module" src="/@keel/entry.ts"></script>\n  </body>\n</html>\n`;
const TOPOLOGY =
  "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['s'], adapter: 'client' } })\n";

let withFile = "";
let without = "";
beforeAll(() => {
  withFile = materialize({ ...staticTree("none", TOPOLOGY), "index.html": INDEX });
  without = materialize(staticTree("none", TOPOLOGY));
}, SLOW);
afterAll(() => {
  cleanup(withFile);
  cleanup(without);
});
afterEach(async () => {
  await stopAll();
});

const names = (r: ReturnType<typeof diags>): string =>
  r.map((d) => `${String(d.path)} ${String(d.message)}`).join("\n");

test(
  "the built `dist/web/index.html` of a `client` deployable holds none of a project `index.html`'s markup, and its `<title>` is `web`.",
  () => {
    const r = keel(withFile, ["build"]);
    expect(r.status).toBe(0);
    const html = readText(withFile, "dist/web/index.html");
    expect(html).not.toContain("Only here");
    expect(html).toMatch(/<title>web<\/title>/);
    expect(existsSync(`${withFile}/dist/index.html`)).toBe(false);
  },
  SLOW,
);

test(
  "`keel dev`'s document of a `client` deployable holds none of a project `index.html`'s markup.",
  async () => {
    const port = await freePort();
    const p = startDev(withFile, port);
    try {
      expect(await served(p, port), p.out()).toBe(true);
      const res = await get(port, "/");
      expect(res?.status).toBe(200);
      expect(res?.body).not.toContain("Only here");
    } finally {
      await stop(p);
    }
  },
  SLOW,
);

test(
  "W1012: a project root holding `index.html` is one W1012 naming `index.html` per `keel check` and per `keel build`, and none without the file.",
  () => {
    for (const cmd of ["check", "build"]) {
      const bad = diags(keel(withFile, [cmd]), "W1012");
      expect(bad, cmd).toHaveLength(1);
      expect(names(bad), cmd).toContain("index.html");
      expect(diags(keel(without, [cmd]), "W1012"), cmd).toEqual([]);
    }
  },
  SLOW,
);

test(
  "W1012: `keel dev` prints one W1012 naming `index.html` for a project root holding the file, and none without it.",
  async () => {
    for (const [dir, want] of [
      [withFile, 1],
      [without, 0],
    ] as const) {
      const port = await freePort();
      const p = startDev(dir, port);
      try {
        expect(await served(p, port), p.out()).toBe(true);
        const hits = p
          .out()
          .split("\n")
          .filter((l) => l.includes('"W1012"'));
        expect(hits).toHaveLength(want);
        if (want === 1) expect(hits[0]).toContain("index.html");
      } finally {
        await stop(p);
      }
    }
  },
  SLOW,
);
