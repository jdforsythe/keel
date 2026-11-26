// The content security policy as a reader's browser gets it from the built golden-1 (k.security, k.origins): a copy
// whose `web` client (served by the `api` node) declares an `img` and a `connect` origin and whose `api` declares an
// `img` origin of its own. `keel build` writes `dist/web/csp.txt` with the client's origins and not the host's; the
// built `api` answers `/` and a client path with exactly that policy; a JSON answer keeps its closed policy.
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, serve } from "@keel/testing/e2e";
import { fixedTime } from "@keel/tooling/test-time";
import { expect, it } from "vitest";

const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", "dist", ".keel", ".keel-dev", ".turbo", "reports", ".api.storage"]);
const WEB_IMG = "https://img.example";
const WEB_CONNECT = "https://events.example";
const API_IMG = "https://api-img.example";

// The build of a copy is the machine's own work, not a bound the test chose.
it(
  "the client's csp.txt holds its declared origins, and the api serves it on documents and a closed policy on JSON",
  { timeout: fixedTime(240_000) },
  async () => {
    const tmp = await mkdtemp(join(tmpdir(), "keel-e2e-csp-"));
    try {
      const dir = join(tmp, "app");
      // No `test/`: the copy is built alone, and vitest resolves from the workspace root, not from the copy.
      await cp(here, dir, {
        recursive: true,
        filter: (src) => src === here || (src !== join(here, "test") && !SKIP.has(basename(src))),
      });
      await symlink(join(here, "node_modules"), join(dir, "node_modules"), "dir");
      const topo = join(dir, "topology.ts");
      const text = await readFile(topo, "utf8");
      const planted = text
        .replace(
          'servedBy: "api",',
          `servedBy: "api",\n    origins: { img: { "${WEB_IMG}": "photos" }, connect: { "${WEB_CONNECT}": "analytics" } },`,
        )
        .replace(
          'adapter: "node", storage: "sqlite"',
          `adapter: "node", storage: "sqlite", origins: { img: { "${API_IMG}": "api images" } }`,
        );
      expect(planted.includes(WEB_IMG) && planted.includes(API_IMG)).toBe(true);
      await writeFile(topo, planted);
      await build(dir);

      const txt = (await readFile(join(dir, "dist", "web", "csp.txt"), "utf8")).trim();
      // csp.txt holds the client's origins, lacks the host's, and has no nonce or report directive.
      expect(txt).toContain(`img-src 'self' ${WEB_IMG}`);
      expect(txt).toContain(`connect-src 'self' ${WEB_CONNECT}`);
      expect(txt).not.toContain(API_IMG);
      expect(txt).toContain("script-src 'self'");
      expect(txt).not.toMatch(/nonce|report-/);

      const app = await serve({ project: dir });
      const html = { accept: "text/html" };
      const root = await app.fetch("/", { headers: html });
      expect(root.status).toBe(200);
      expect(root.headers.get("content-security-policy")).toBe(txt);
      const deep = await app.fetch("/lists/l1", { headers: html });
      expect(deep.status).toBe(200);
      expect(deep.headers.get("content-security-policy")).toBe(txt);
      const json = await app.fetch("/api/lists", { headers: { accept: "application/json" } });
      expect(json.status).toBe(200);
      expect(json.headers.get("content-security-policy")).toBe("default-src 'none'; frame-ancestors 'none'");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  },
);
