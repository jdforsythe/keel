// Spec: k.topology, Conformance "With `styles: ['@keel/ui/fonts']`, a `node` document served by `keel dev` links a stylesheet holding that file's `@font-face` rules, each `url()` answering 200; without it, the stylesheet holds none."
// Seed: 1337 (no generated input: two fixtures, one `keel dev` each on a free port, the child's group ended in `finally`).
// ASSUMPTIONS: the document is GET `/` with `accept: text/html`; a `url()` resolves against the stylesheet's URL; `data:` urls are not fetched.
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { cleanup, materialize } from "./compat-support.ts";
import { SLOW, freePort, get, served, startDev, staticTree, stop, stopAll, stylesheetsOf } from "./static-support.ts";

const topo = (styles: string): string =>
  `import { topology } from '@keel/server'\nexport default topology({ site: { modules: ['s'], adapter: 'node'${styles} } })\n`;

let styled = "";
let plain = "";
beforeAll(() => {
  styled = materialize(staticTree("none", topo(", styles: ['@keel/ui/fonts']")));
  plain = materialize(staticTree("none", topo("")));
}, SLOW);
afterAll(() => {
  cleanup(styled);
  cleanup(plain);
});
afterEach(async () => {
  await stopAll();
});

async function devCss(dir: string): Promise<{ base: URL; css: string }[]> {
  const port = await freePort();
  const p = startDev(dir, port);
  try {
    expect(await served(p, port), p.out()).toBe(true);
    const doc = await get(port, "/");
    expect(doc?.status).toBe(200);
    const head = /<head[\s\S]*?<\/head>/.exec(doc?.body ?? "")?.[0] ?? "";
    const out: { base: URL; css: string }[] = [];
    for (const href of stylesheetsOf(head)) {
      const base = new URL(href, `http://localhost:${port}/`);
      const res = await fetch(base);
      expect(res.status, href).toBe(200);
      out.push({ base, css: await res.text() });
    }
    expect(out.length).toBeGreaterThan(0);
    // Fetch every url() while the server is up.
    for (const { base, css } of out) {
      if (!css.includes("@font-face")) continue;
      const urls = [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)]
        .map((m) => m[1] ?? "")
        .filter((u) => u !== "" && !u.startsWith("data:"));
      expect(urls.length).toBeGreaterThan(0);
      for (const u of urls) expect((await fetch(new URL(u, base))).status, u).toBe(200);
    }
    return out;
  } finally {
    await stop(p);
  }
}

test(
  "With `styles: ['@keel/ui/fonts']`, a `node` document served by `keel dev` links a stylesheet holding that file's `@font-face` rules, each `url()` answering 200.",
  async () => {
    const found = await devCss(styled);
    expect(found.some((s) => s.css.includes("@font-face"))).toBe(true);
  },
  SLOW,
);

test(
  "Without `styles`, the stylesheet a `node` document served by `keel dev` links holds no `@font-face` rule.",
  async () => {
    const found = await devCss(plain);
    expect(found.some((s) => s.css.includes("@font-face"))).toBe(false);
  },
  SLOW,
);
