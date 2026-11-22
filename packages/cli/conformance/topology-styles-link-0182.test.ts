// Spec: k.topology, Conformance "With `styles: ['@keel/ui/fonts']`, a built `node` document's head and a built `client` `index.html` each link a stylesheet holding that file's `@font-face` rules; without it, neither does."
// Spec: k.topology, Declaration "`styles` lists package specifiers whose export is a `.css` file (`['@keel/ui/fonts']`): each is imported by the deployable's entry, so its documents link it (k.head) in dev and build."
// Seed: 1337 (no generated input: two fixtures, spawned builds). Pending: `styles` is not read yet.
// ASSUMPTIONS: the node deployable `api` serves its built document from `node dist/api/server.mjs` (PORT, KEEL_SECRET) and its stylesheet at the linked `href`; the client
// `dist/web/index.html` links a stylesheet whose file is under `dist/web/`; "holding that file's `@font-face` rules" is the text containing `@font-face`.
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { cleanup, keel, materialize, readText } from "./compat-support.ts";
import { tree } from "./origins-support.ts";
import { SLOW, get, stopAll, stylesheetsOf, withServer } from "./static-support.ts";

const topo = (styles: string): string =>
  `{ api: { modules: ['a'], adapter: 'node'${styles} }, web: { modules: ['c'], adapter: 'client'${styles} } }`;
const FONTS = ", styles: ['@keel/ui/fonts']";

let styled = "";
let plain = "";
beforeAll(() => {
  styled = materialize(tree(topo(FONTS)));
  plain = materialize(tree(topo("")));
}, SLOW);
afterAll(() => {
  cleanup(styled);
  cleanup(plain);
});
afterEach(async () => {
  await stopAll();
});

const clientCss = (dir: string): string[] =>
  stylesheetsOf(readText(dir, "dist/web/index.html")).map((href) =>
    readText(dir, `dist/web${href.startsWith("/") ? "" : "/"}${href}`),
  );

async function nodeCss(dir: string): Promise<string[]> {
  const out: string[] = [];
  await withServer(dir, "api", async (port) => {
    const doc = await get(port, "/a");
    expect(doc?.status).toBe(200);
    const head = /<head[\s\S]*?<\/head>/.exec(doc?.body ?? "")?.[0] ?? "";
    for (const href of stylesheetsOf(head)) out.push((await get(port, href))?.body ?? "");
  });
  return out;
}

test(
  "With `styles: ['@keel/ui/fonts']`, a built `node` document's head and a built `client` `index.html` each link a stylesheet holding that file's `@font-face` rules.",
  async () => {
    expect(keel(styled, ["build"]).status).toBe(0);
    expect(clientCss(styled).some((css) => css.includes("@font-face"))).toBe(true);
    expect((await nodeCss(styled)).some((css) => css.includes("@font-face"))).toBe(true);
  },
  SLOW,
);

test(
  "Without `styles`, neither a built `node` document's head nor a built `client` `index.html` links a stylesheet holding `@font-face` rules.",
  async () => {
    expect(keel(plain, ["build"]).status).toBe(0);
    expect(clientCss(plain).some((css) => css.includes("@font-face"))).toBe(false);
    expect((await nodeCss(plain)).some((css) => css.includes("@font-face"))).toBe(false);
  },
  SLOW,
);
