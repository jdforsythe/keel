// `keel dev` splits server-only files by consumer (k.boundary, k.bundle): the browser, which loads the client
// environment's modules natively, gets the stub a browser build gets; the dev server's own module runner and a test
// runner's client environment (a module runner too) get the file itself.
import fs from "node:fs";
import path from "node:path";
import keel from "@keel/compiler/vite";
import { type ViteDevServer, createServer } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let root = "";
let server: ViteDevServer | undefined;
const write = (rel: string, text: string): void => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};
beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-dev-stubs-"));
  write("topology.ts", `export default { api: { modules: ["a"], adapter: "node" } };\n`);
  write(
    "modules/a/load.server.ts",
    `import { randomBytes } from "node:crypto";\nexport const canary = "SERVER_CANARY";\nexport function load() {\n  return randomBytes(1);\n}\n`,
  );
  write("modules/a/Page.ts", `import { load } from "./load.server.ts";\nexport const page = load;\n`);
});
afterEach(async () => {
  await server?.close();
  server = undefined;
  fs.rmSync(root, { recursive: true, force: true });
});

/** A dev server on the fixture; `runner` makes its client environment a module runner, as a test runner's is. */
async function serve(runner: boolean): Promise<ViteDevServer> {
  server = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [keel()],
    server: { middlewareMode: true, ws: false, watch: null },
    environments: runner ? { client: { dev: { moduleRunnerTransform: true } } } : {},
  });
  return server;
}

describe("keel dev server-only files", () => {
  it("gives the browser the stub: no node: specifier, no server code", async () => {
    const s = await serve(false);
    const page = await s.environments.client.transformRequest("/modules/a/Page.ts");
    expect(page?.code).toContain("load.server.ts");
    const out = await s.environments.client.transformRequest("/modules/a/load.server.ts");
    expect(out?.code).not.toContain("node:");
    expect(out?.code).not.toContain("SERVER_CANARY");
    expect(out?.code).toContain("load");
  });

  it("gives the dev server's own runner the file itself", async () => {
    const s = await serve(false);
    await s.environments.client.transformRequest("/modules/a/load.server.ts");
    const out = await s.environments.ssr.transformRequest("/modules/a/load.server.ts");
    expect(out?.code).toContain("SERVER_CANARY");
    expect(out?.code).toContain("node:crypto");
  });

  it("gives a module runner on the client environment, as tests use, the file itself", async () => {
    const s = await serve(true);
    const out = await s.environments.client.transformRequest("/modules/a/load.server.ts");
    expect(out?.code).toContain("SERVER_CANARY");
  });
});
