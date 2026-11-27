// Spec: k.serverlog, clause "A loader of a `keel build` fixture whose `defect('x')` call stands on line 12 of `modules/p/def.server.ts`, run from `node dist/<name>/server.mjs` in production mode, logs a `diag` whose message ends ` at modules/p/def.server.ts:12`; a thrown string logs no ` at `."
// Seed 1337 (no generated input: one fixture, two requests). The real binary builds a `node` project; `dist/api/server.mjs` runs in production mode (no `KEEL_LOG_THROWN`, so the record ends at the fingerprint or the site).
// The `defect('x')` call is on line 12 of `modules/p/def.server.ts` (the file is padded with comment lines); the thrown string comes from a plain npm package (`boomer`), since app code has no `throw`.
// The readiness probe requests `/ready`, which no route owns, so each case logs only its own request.
import { type ChildProcess, spawn } from "node:child_process";
import net from "node:net";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { SLOW, base, childEnv, cleanup, keelRun, manifestSrc, materialize, send } from "./boundary-support.ts";

const children: ChildProcess[] = [];
let dir = "";
afterEach(() => {
  for (const c of children.splice(0)) c.kill("SIGKILL");
});
afterAll(() => cleanup(dir));

const pad = (head: readonly string[], line12: string): string => {
  const lines = [...head];
  while (lines.length < 11) lines.push("// padding so that the call below stands on line 12");
  lines.push(line12);
  return `${lines.join("\n")}\n`;
};
const HEAD = [
  'import { loader } from "@keel/router";',
  'import { defect } from "@keel/schema";',
  'import { p } from "./p.contract.ts";',
  'import { Out } from "./Out.schema.ts";',
];

beforeAll(() => {
  dir = materialize({
    ...base(),
    "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: { boomer: "1.0.0" } })}\n`,
    "node_modules/boomer/package.json": `${JSON.stringify({ name: "boomer", version: "1.0.0", type: "module", main: "index.js", types: "index.d.ts" })}\n`,
    "node_modules/boomer/index.d.ts": "export declare const boom: () => void\n",
    "node_modules/boomer/index.js": "export const boom = () => {\n  throw 's'\n}\n",
    "topology.ts":
      "import { topology } from '@keel/server'\nexport default topology({ api: { modules: ['p'], adapter: 'node' } })\n",
    "modules/p/module.ts": manifestSrc("p"),
    "modules/p/Out.schema.ts": "import { s } from '@keel/schema'\nexport const Out = s.object({ title: s.string() })\n",
    "modules/p/p.contract.ts":
      "import { contract } from '@keel/router/contract'\nexport const p = contract('p', { 'p.def': { path: '/def' }, 'p.str': { path: '/str' } })\n",
    "modules/p/Page.tsx":
      "import { Box, Text } from '@keel/ui'\nexport default function Page() {\n  return (\n    <Box as=\"main\">\n      <Text>p</Text>\n    </Box>\n  )\n}\n",
    "modules/p/def.server.ts": `${pad(HEAD, "export const def = loader(p, 'p.def', { output: Out }, async () => defect('x'));")}`,
    "modules/p/str.server.ts":
      "import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { boom } from 'boomer'\nimport { p } from './p.contract.ts'\nimport { Out } from './Out.schema.ts'\nexport const str = loader(p, 'p.str', { output: Out }, async () => {\n  boom()\n  return ok({ title: 'x' })\n})\n",
    "modules/p/routes.ts":
      "import { manifest } from '@keel/router'\nimport Page from './Page.tsx'\nimport { def } from './def.server.ts'\nimport { p } from './p.contract.ts'\nimport { str } from './str.server.ts'\nexport const routes = manifest(p, {\n  'p.def': { component: Page, loader: def },\n  'p.str': { component: Page, loader: str },\n})\n",
  });
  const r = keelRun(dir, ["build"]);
  expect(r.status, r.out).toBe(0);
}, SLOW);

async function messages(path: string): Promise<string[]> {
  const port = await freePort();
  const child = spawn(process.execPath, [join(dir, "dist", "api", "server.mjs")], {
    cwd: dir,
    env: childEnv({ PORT: String(port), KEEL_SECRET: "s".repeat(32), KEEL_FORMAT: "json" }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  let text = "";
  child.stdout?.on("data", (d: Buffer) => void (text += d.toString()));
  child.stderr?.on("data", (d: Buffer) => void (text += d.toString()));
  for (let i = 0; i < 4000; i++) {
    const up = await send(port, "GET", "/ready", { accept: "application/json" }).then(
      () => true,
      () => false,
    );
    if (up) break;
  }
  await send(port, "GET", path, { accept: "application/json" });
  return text
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l): unknown => JSON.parse(l))
    .flatMap((r) =>
      typeof r === "object" && r !== null && Reflect.get(r, "kind") === "diag"
        ? [String(Reflect.get(r, "message"))]
        : [],
    );
}

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });

test(
  "a loader of a `keel build` fixture whose `defect('x')` call stands on line 12 of `modules/p/def.server.ts`, run from `node dist/<name>/server.mjs` in production mode, logs a `diag` whose message ends ` at modules/p/def.server.ts:12`",
  async () => {
    const m = (await messages("/def")).filter((x) => x.startsWith("loader p.def threw"));
    expect(m, m.join("\n")).toHaveLength(1);
    expect(m[0]?.endsWith(" at modules/p/def.server.ts:12")).toBe(true);
  },
  SLOW,
);

test(
  "a thrown string logs no ` at `",
  async () => {
    const m = (await messages("/str")).filter((x) => x.startsWith("loader p.str threw"));
    expect(m, m.join("\n")).toHaveLength(1);
    expect(m[0]).not.toContain(" at ");
  },
  SLOW,
);
