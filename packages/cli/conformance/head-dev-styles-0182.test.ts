// Spec: k.head, Conformance "Under `keel dev`, a `node` deployable's document and a `client` deployable's `index.html` each link a stylesheet that answers 200 as `text/css` and holds the atomic rules of every `k-*` class the served page uses and the `@font-face` rules of its `styles`."
// Seed: 1337 (no generated input: two fixtures, one `keel dev` each on a free port from a closed port-0 listener, the child's group ended in `finally`).
// ASSUMPTIONS: the node document is GET `/` with `accept: text/html`; "holds the atomic rule of a class" is the stylesheet text containing `.<class>`;
// a `client` document is the empty `#app` shell (its page renders in the browser), so the `k-*` check is made on the node document only.
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { cleanup, materialize } from "./compat-support.ts";
import { SLOW, freePort, get, served, startDev, staticTree, stop, stopAll, stylesheetsOf } from "./static-support.ts";

const topo = (adapter: string): string =>
  `import { topology } from '@keel/server'\nexport default topology({ site: { modules: ['s'], adapter: '${adapter}', styles: ['@keel/ui/fonts'] } })\n`;

let node = "";
let client = "";
beforeAll(() => {
  node = materialize(staticTree("none", topo("node")));
  client = materialize(staticTree("none", topo("client")));
}, SLOW);
afterAll(() => {
  cleanup(node);
  cleanup(client);
});
afterEach(async () => {
  await stopAll();
});

const classesOf = (html: string): string[] => [
  ...new Set([...html.matchAll(/\bk-[A-Za-z0-9_-]+/g)].map((m) => m[0])),
];

async function sheets(port: number, html: string): Promise<{ href: string; type: string; status: number; css: string }[]> {
  const out = [];
  for (const href of stylesheetsOf(html)) {
    const res = await fetch(new URL(href, `http://localhost:${port}/`));
    out.push({ href, type: res.headers.get("content-type") ?? "", status: res.status, css: await res.text() });
  }
  return out;
}

test(
  "Under `keel dev`, a `node` deployable's document links a stylesheet that answers 200 as `text/css` and holds the atomic rules of every `k-*` class the page uses and the `@font-face` rules of its `styles`.",
  async () => {
    const port = await freePort();
    const p = startDev(node, port);
    try {
      expect(await served(p, port), p.out()).toBe(true);
      const doc = await get(port, "/");
      expect(doc?.status).toBe(200);
      const head = /<head[\s\S]*?<\/head>/.exec(doc?.body ?? "")?.[0] ?? "";
      const found = await sheets(port, head);
      expect(found.length).toBeGreaterThan(0);
      for (const s of found) {
        expect(s.status, `${s.href} ${s.css.slice(0, 1200)}`).toBe(200);
        expect(s.type, s.href).toMatch(/^text\/css/);
      }
      const css = found.map((s) => s.css).join("\n");
      expect(css).toContain("@font-face");
      const used = classesOf(/<body[\s\S]*<\/body>/.exec(doc?.body ?? "")?.[0] ?? "");
      expect(used.length).toBeGreaterThan(0);
      for (const c of used) expect(css, c).toContain(`.${c}`);
    } finally {
      await stop(p);
    }
  },
  SLOW,
);

test(
  "Under `keel dev`, a `client` deployable's `index.html` links a stylesheet that answers 200 as `text/css` and holds the `@font-face` rules of its `styles`.",
  async () => {
    const port = await freePort();
    const p = startDev(client, port);
    try {
      expect(await served(p, port), p.out()).toBe(true);
      const doc = await get(port, "/");
      expect(doc?.status).toBe(200);
      const found = await sheets(port, doc?.body ?? "");
      expect(found.length).toBeGreaterThan(0);
      for (const s of found) {
        expect(s.status, s.href).toBe(200);
        expect(s.type, s.href).toMatch(/^text\/css/);
      }
      expect(found.some((s) => s.css.includes("@font-face"))).toBe(true);
    } finally {
      await stop(p);
    }
  },
  SLOW,
);
