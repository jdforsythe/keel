// Spec: k.guards (rfc:0209), Conformance "`keel test` over a project with `identity.ts` beside `topology.ts`, which no module file imports, whose one test asserts that `renderRoute(id, { routes })`'s `requests()` holds one entry whose `url` ends `/__keel/user`, passes; with `identity.ts` and `identity.server.ts` removed, the same test fails."
// Spec: k.guards (rfc:0209), Client "Under vitest with the `keel()` plugin, as `keel test` runs it, the project's `identity.ts` beside `topology.ts` is evaluated before each test file, as the built entry imports it; so a test sees the read exactly when the built app sends it (k.requests)."
// The real `keel` binary runs `keel test` over a temp project (OS tmpdir), once with `identity.ts` and `identity.server.ts` and once without. No module file imports `identity.ts`.
// Besides the clause's one test, a second test file counts the `/__keel/user` entries of two routers (one per `renderRoute`): one each with `identity.ts` (so the plugin evaluated it before that file, not only the first), none without. Seed: no generated inputs, n/a.
// ASSUMPTIONS: the project needs `module.ts`, a contract and routes for the one page; topology `web` is a `client` deployable `servedBy` an `api` node (E1589 otherwise); `keel test` needs no `vitest.config.ts`.
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Run, keel, removeFile, removeProject, root, summaryOf, writeFiles } from "./test-sim-project.ts";

// The docblock is spelled in two pieces so vitest does not read it as this file's own environment.
const ENV = ["// @vitest", "-environment happy-dom"].join("");
const PACKAGES = ["ctx", "schema", "testing", "router", "compiler", "server"];
const EXTERNAL = ["vitest", "vite", "fast-check", "happy-dom", "typescript"];

const FILES: Readonly<Record<string, string>> = {
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
  "test/read.test.ts": `${ENV}
import { renderRoute } from "@keel/testing"
import { expect, it } from "vitest"
import { routes } from "../modules/a/routes.ts"

it("renderRoute's requests() holds one entry whose url ends /__keel/user", async () => {
  const h = await renderRoute("a.page", { routes })
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

it("counts the reads of two routers", async () => {
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
  const dir = mkdtempSync(join(tmpdir(), "keel-identity-read-"));
  writeFiles(dir, FILES);
  mkdirSync(join(dir, "node_modules", "@keel"), { recursive: true });
  for (const p of PACKAGES) symlinkSync(join(root, "packages", p), join(dir, "node_modules", "@keel", p));
  for (const e of EXTERNAL) symlinkSync(join(root, "node_modules", e), join(dir, "node_modules", e));
  return dir;
}

const counts = (dir: string): unknown => JSON.parse(readFileSync(join(dir, "test", "counts.json"), "utf8"));

let withIdentity = "";
let without = "";
let runWith: Run | undefined;
let runWithout: Run | undefined;

beforeAll(() => {
  withIdentity = makeDir();
  runWith = keel(withIdentity, ["test"]);
  without = makeDir();
  removeFile(without, "identity.ts");
  removeFile(without, "identity.server.ts");
  runWithout = keel(without, ["test"]);
}, 300_000);

afterAll(() => {
  removeProject(withIdentity);
  removeProject(without);
});

describe("k.guards: `keel test` evaluates identity.ts before each test file", () => {
  it("`keel test` over a project with identity.ts beside topology.ts, no module file importing it, whose test asserts requests() holds one entry ending /__keel/user, passes", () => {
    expect(summaryOf(runWith ?? { status: null, records: [], stdout: "" })).toMatchObject({
      kind: "summary",
      ok: true,
      counts: { tests: 2, failed: 0 },
    });
    expect(runWith?.status).toBe(0);
  });

  it("with identity.ts and identity.server.ts removed, the same test fails", () => {
    expect(runWithout?.status).not.toBe(0);
    expect(summaryOf(runWithout ?? { status: null, records: [], stdout: "" })).toMatchObject({
      kind: "summary",
      ok: false,
      counts: { failed: 1 },
    });
  });

  it("the project with identity.ts sends exactly one /__keel/user request per router, in each test file", () => {
    expect(counts(withIdentity)).toEqual([1, 1]);
  });

  it("the client-only project (no identity.ts) sends no /__keel/user request", () => {
    expect(counts(without)).toEqual([0, 0]);
  });
});
