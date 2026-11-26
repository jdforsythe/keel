// The content security policy of a built `node` deployable's own document (k.security, k.origins): a copy of the
// example that also declares a `connect` origin answers with k.security's policy and a fresh nonce, the declared
// origins in `img-src` and `connect-src` in declaration order, and no origin it did not declare; two documents carry
// different nonces.
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, serve } from "@keel/testing/e2e";
import { fixedTime } from "@keel/tooling/test-time";
import { expect, it } from "vitest";

const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", "dist", ".keel", ".keel-dev", ".turbo", "reports"]);
const TILES = "https://tile.openstreetmap.org";
const NODE_CONNECT = "https://telemetry.example";
const DECLARED = 'origins: { img: { "https://tile.openstreetmap.org": "map tiles on the home page" } },';

/** A copy of the example in a temporary folder whose topology's declared origins are `origins` and whose page shows `tile`, built. */
async function copyWith(
  origins: string,
  tile = '"https://tile.openstreetmap.org/0/0/0.png"',
): Promise<{ tmp: string; dir: string }> {
  const tmp = await mkdtemp(join(tmpdir(), "keel-e2e-csp-example-"));
  const dir = join(tmp, "app");
  // No `test/`: the copy is built alone, and vitest resolves from the workspace root, not from the copy.
  await cp(here, dir, {
    recursive: true,
    filter: (src) => src === here || (src !== join(here, "test") && !SKIP.has(basename(src))),
  });
  await symlink(join(here, "node_modules"), join(dir, "node_modules"), "dir");
  const replace = async (file: string, from: string, to: string): Promise<void> => {
    const text = await readFile(file, "utf8");
    const next = text.replace(from, to);
    if (next === text && from !== to) throw new Error(`${file} has no ${from}`);
    await writeFile(file, next);
  };
  await replace(join(dir, "topology.ts"), DECLARED, origins);
  await replace(join(dir, "modules", "app", "HomePage.tsx"), '"https://tile.openstreetmap.org/0/0/0.png"', tile);
  await build(dir);
  return { tmp, dir };
}

// The build of a copy is the machine's own work, not a bound the test chose.
it(
  "the document's policy is k.security's with the declared origins and a fresh nonce",
  { timeout: fixedTime(240_000) },
  async () => {
    const { tmp, dir } = await copyWith(
      `origins: {\n      img: { "${TILES}": "map tiles on the home page" },\n      connect: { "${NODE_CONNECT}": "usage counts" },\n    },`,
    );
    try {
      const app = await serve({ project: dir });
      const doc = await app.fetch("/", { headers: { accept: "text/html" } });
      const policy = doc.headers.get("content-security-policy") ?? "";
      const html = await doc.text();
      const nonce = /'nonce-([^']+)'/.exec(policy)?.[1] ?? "";
      const expected = [
        "default-src 'none'",
        `script-src 'nonce-${nonce}' 'strict-dynamic'`,
        "style-src 'self'",
        `img-src 'self' ${TILES}`,
        "font-src 'self'",
        `connect-src 'self' ${NODE_CONNECT}`,
        "manifest-src 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "object-src 'none'",
        "require-trusted-types-for 'script'",
        "trusted-types keel",
        "report-uri /__keel/csp",
        "report-to keel-csp",
      ].join("; ");
      expect(doc.status).toBe(200);
      expect(policy).toBe(expected);
      // The nonce is the module script's.
      expect(nonce).toHaveLength(64);
      expect(html).toContain(`nonce="${nonce}"`);
      expect(
        ["https://img.example", "https://events.example", "https://api-img.example"].some((o) => policy.includes(o)),
      ).toBe(false);
      // A second document has a new nonce and the same policy otherwise.
      const again =
        (await app.fetch("/", { headers: { accept: "text/html" } })).headers.get("content-security-policy") ?? "";
      expect(again).not.toBe(policy);
      expect(again.replace(/'nonce-[^']+'/, "")).toBe(policy.replace(/'nonce-[^']+'/, ""));
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  },
);

it(
  "an image at an origin the policy does not list is blocked by the browser, a csp problem the test reads",
  // Building a copy of the example and starting it: the machine's own work.
  { timeout: fixedTime(240_000) },
  async () => {
    const { tmp, dir } = await copyWith(DECLARED, '{["https:", "", "undeclared.example", "0.png"].join("/")}');
    try {
      const app = await serve({ project: dir });
      const page = await app.open("/");
      await page.find("app.home.tile");
      await page.settle();
      const problems = page.problems();
      const csp = problems.filter((p) => p.kind === "csp");
      expect(csp.map((p) => p.text)).toEqual(["img-src blocked https://undeclared.example/0.png"]);
      expect(problems.filter((p) => p.kind === "console").every((p) => p.text.includes("undeclared.example"))).toBe(
        true,
      );
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  },
);
