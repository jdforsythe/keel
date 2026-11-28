// Spec: k.guards, clause "Over a project with `identity.ts` and `identity.server.ts` beside `topology.ts` and a `vitest.config.ts` using the `keel()` plugin, which no module file imports, one test file asserting that `renderRoute(id, { routes })`'s `requests()` is `[]`, and a second importing `identity.ts`'s default export as `mount` and asserting that `renderRoute(id, { routes, mount })`'s `requests()` is exactly one entry, whose `url` ends `/__keel/user`: `keel test` passes both files, and so does `vitest run` in the project."
// k.guards, Client "A `renderRoute` router reads only when its test names the identity mount: the `mount` option, the default export of `identity.ts` that the test file imports (`import mount from '../identity.ts'`), as the built entry imports it and passes it to `createRouter`. With `mount` and without `user` it sends the GET as a built one does, its own `mount` (k.mount-scope) that mount's `path`; without `mount` it sends none, whatever the test's modules import. Nothing outside the test file is loaded for it, by `keel test` or by vitest, so a test runs the same under both and sees the read exactly when it names the mount (k.requests)."
// The real `keel` binary runs `keel test` over a temp project (OS tmpdir), and vitest runs in the same project (plainVitest); both runs see both test files. No module file imports `identity.ts`. A third file, with no `mount`, records the `/__keel/user` count of two routers to a file and the same count is read after each run: none under either runner, so nothing was loaded before the file.
// Seed: no generated inputs, n/a.
// ASSUMPTIONS: the project needs `module.ts`, a contract and routes for the one page; topology `web` is a `client` deployable `servedBy` an `api` node (E1589 otherwise); `keel test` needs no `vitest.config.ts`, the plain run does, and it holds the `keel()` plugin (`@keel/compiler/vite`).
import { fixedTime } from "@keel/tooling/test-time";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Run, keel, plainVitest, root, summaryOf, writeFiles } from "./test-sim-project.ts";

// The docblock is spelled in two pieces so vitest does not read it as this file's own environment.
const ENV = ["// @vitest", "-environment happy-dom"].join("");
const PACKAGES = ["ctx", "schema", "reactive", "testing", "router", "compiler", "server"];
const EXTERNAL = ["vitest", "vite", "fast-check", "happy-dom", "typescript"];

const FILES: Readonly<Record<string, string>> = {
  "vitest.config.ts": `import keel from "@keel/compiler/vite"
import { defineConfig } from "vitest/config"
export default defineConfig({ plugins: [keel()] })
`,
  "topology.ts": `import { topology } from "@keel/server"
export default topology({
  web: { modules: ["a"], adapter: "client", servedBy: "api" },
  api: { modules: ["b"], adapter: "node" },
})
`,
  "identity.ts": `import { identityMount } from "@keel/router"
export default identityMount("/api/auth")
`,
  "identity.server.ts": `import { identity } from "@keel/server"
import mount from "./identity.ts"
export default identity({ identify: async () => "", handle: { path: mount.path, fn: () => new Response("") } })
`,
  "modules/a/module.ts": `import { module } from "@keel/compiler"
export default module({ id: "a", deps: [], capabilities: [], public: { exports: [] } })
`,
  "modules/a/a.contract.ts": `import { contract } from "@keel/router/contract"
export const a = contract("a", { "a.page": { path: "/orders" } })
`,
  "modules/a/routes.ts": `import { manifest } from "@keel/router"
import { a } from "./a.contract.ts"
const Page = () => document.createElement("p")
export const routes = manifest(a, { "a.page": { component: Page } })
`,
  "modules/b/module.ts": `import { module } from "@keel/compiler"
export default module({ id: "b", deps: [], capabilities: [], public: { exports: [] } })
`,
  "modules/b/b.contract.ts": `import { contract } from "@keel/router/contract"
export const b = contract("b", { "b.page": { path: "/things" } })
`,
  "modules/b/routes.ts": `import { manifest } from "@keel/router"
import { b } from "./b.contract.ts"
const Page = () => document.createElement("p")
export const routes = manifest(b, { "b.page": { component: Page } })
`,
  "test/nomount.test.ts": `${ENV}
import { renderRoute } from "@keel/testing"
import { expect, it } from "vitest"
import { routes } from "../modules/a/routes.ts"

it("renderRoute(id, { routes })'s requests() is []", async () => {
  const h = await renderRoute("a.page", { routes })
  await h.settle()
  expect(h.requests()).toEqual([])
  h.dispose()
})
`,
  "test/mount.test.ts": `${ENV}
import { renderRoute } from "@keel/testing"
import { expect, it } from "vitest"
import mount from "../identity.ts"
import { routes } from "../modules/a/routes.ts"

it("renderRoute(id, { routes, mount })'s requests() is exactly one entry whose url ends /__keel/user", async () => {
  const h = await renderRoute("a.page", { routes, mount })
  await h.settle()
  const log = h.requests()
  expect(log).toHaveLength(1)
  expect(log[0]?.url.endsWith("/__keel/user")).toBe(true)
  h.dispose()
})
`,
  "test/count.test.ts": `${ENV}
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { renderRoute } from "@keel/testing"
import { it } from "vitest"
import { routes } from "../modules/a/routes.ts"

it("counts the reads of two routers that name no mount", async () => {
  const counts: number[] = []
  for (let i = 0; i < 2; i++) {
    const h = await renderRoute("a.page", { routes })
    await h.settle()
    counts.push(h.requests().filter((e) => e.url.endsWith("/__keel/user")).length)
    h.dispose()
  }
  writeFileSync(join(process.cwd(), "test", "counts.json"), JSON.stringify(counts))
})
`,
};

function makeDir(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "keel-identity-read-")));
  writeFiles(dir, FILES);
  mkdirSync(join(dir, "node_modules", "@keel"), { recursive: true });
  for (const p of PACKAGES) symlinkSync(join(root, "packages", p), join(dir, "node_modules", "@keel", p));
  for (const e of EXTERNAL) symlinkSync(join(root, "node_modules", e), join(dir, "node_modules", e));
  return dir;
}

/** The counts the third test file wrote, or "not written" when the run stopped before it. */
const counts = (dir: string): unknown => {
  try {
    return JSON.parse(readFileSync(join(dir, "test", "counts.json"), "utf8"));
  } catch {
    return "not written";
  }
};

let dir = "";
let viaKeel: Run | undefined;
let keelCounts: unknown;
let plain: { status: number | null } = { status: null };
let plainCounts: unknown;

beforeAll(() => {
  dir = makeDir();
  viaKeel = keel(dir, ["test"]);
  keelCounts = counts(dir);
  rmSync(join(dir, "test", "counts.json"), { force: true });
  plain = plainVitest(dir);
  plainCounts = counts(dir);
}, fixedTime(300_000));

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("k.guards: a test names the identity mount, and nothing is loaded before a test file", () => {
  it("`keel test` passes both files: the one with no mount and the one passing mount", () => {
    expect(summaryOf(viaKeel ?? { status: null, records: [], stdout: "" })).toMatchObject({
      kind: "summary",
      ok: true,
      counts: { tests: 3, failed: 0 },
    });
    expect(viaKeel?.status).toBe(0);
  });

  it("`vitest run` in the project passes both files too", () => {
    expect(plain.status).toBe(0);
  });

  it("a test file naming no mount sends no /__keel/user request from either router, under `keel test`", () => {
    expect(keelCounts).toEqual([0, 0]);
  });

  it("a test file naming no mount sends no /__keel/user request from either router, under `vitest run`: the run is the same", () => {
    expect(plainCounts).toEqual(keelCounts);
  });
});
