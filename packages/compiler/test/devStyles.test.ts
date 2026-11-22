// `keel dev` links the styles a built document links (k.head Server, Document source; k.topology Declaration): every
// dev document links `/@keel/styles.css?d=<name>`, which holds the deployable's `styles` (their `url()`s served by
// Vite) and the atomic CSS, so a page is styled before any script runs.
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import keel from "@keel/compiler/vite";
import { type ViteDevServer, createServer } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let root = "";
let vite: ViteDevServer | undefined;
let server: http.Server | undefined;
const write = (rel: string, text: string): void => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};
beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-dev-styles-"));
  write(
    "topology.ts",
    `export default { web: { modules: ["a"], adapter: "client", styles: ["brand-faces/fonts"] } };\n`,
  );
  write("modules/a/module.ts", "export default {};\n");
  write(
    "node_modules/brand-faces/package.json",
    JSON.stringify({ name: "brand-faces", exports: { "./fonts": "./fonts.css" } }),
  );
  write("node_modules/brand-faces/fonts.css", '@font-face { font-family: "Brand"; src: url("./brand.woff2"); }\n');
  write("node_modules/brand-faces/brand.woff2", "woff2");
});
afterEach(async () => {
  await new Promise<void>((resolve) => (server === undefined ? resolve() : server.close(() => resolve())));
  await vite?.close();
  server = undefined;
  vite = undefined;
  fs.rmSync(root, { recursive: true, force: true });
});

/** The fixture's dev server behind a local HTTP listener; its base URL. */
async function serve(): Promise<string> {
  vite = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [keel()],
    server: { middlewareMode: true, ws: false, watch: null },
  });
  const mw = vite.middlewares;
  server = http.createServer((req, res) => mw(req, res));
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address: AddressInfo | string | null | undefined = server?.address();
  return `http://127.0.0.1:${typeof address === "object" && address !== null ? address.port : 0}`;
}

describe("keel dev styles", () => {
  it("serves a deployable's styles as one stylesheet, its url()s rewritten to served URLs", async () => {
    const base = await serve();
    const res = await fetch(`${base}/@keel/styles.css?d=web`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/css; charset=utf-8");
    const css = await res.text();
    expect(css).toContain('font-family: "Brand"');
    const font = /url\("?([^")]+)"?\)/.exec(css)?.[1] ?? "";
    expect(font).toMatch(/^\/.*brand\.woff2$/);
    expect((await fetch(`${base}${font}`)).status).toBe(200);
  });

  it("answers 404 for a deployable the topology lacks", async () => {
    const base = await serve();
    expect((await fetch(`${base}/@keel/styles.css?d=nope`)).status).toBe(404);
  });

  it("links the stylesheet in a client deployable's dev document", async () => {
    const base = await serve();
    const html = await (await fetch(`${base}/`, { headers: { accept: "text/html" } })).text();
    expect(html).toContain('<link rel="stylesheet" href="/@keel/styles.css?d=web" />');
  });
});
