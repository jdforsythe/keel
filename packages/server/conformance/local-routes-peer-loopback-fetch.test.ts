// @vitest-environment node
// Spec: k.contract, clause "`ctx.net.fetch` of `y`'s `local: true` page at `http://127.0.0.1:<port>/tools` with `Sec-Fetch-Site: none`, from `unsafe` code in a loader of `x`, both `server.mjs`, gets 200; `y`'s loader runs once."
// Seed: n/a (one request over two built servers). Fixture (the RFC 0244 sketch): a two-`node` `keel build`, `x` serving `a`, `y` serving `b` with page `b.tools` at `/tools` `local: true`.
// `x`'s API GET `a.peek` has a loader that calls `reachPeer` of `modules/a/unsafe/reachPeer.ts`, which takes `y`'s origin from `KEEL_PEER_Y` and does the `ctx.net.fetch` inside an `unsafe` call; it returns the
// status. `y`'s `b.tools` loader counts its runs and the non-local `b.counts` reports them, read from outside (the house form of local-routes-support.ts, in place of the sketch's file).
// Both servers run on free loopback ports, each with the other's origin in `KEEL_PEER_<NAME>`.
// Readiness is any HTTP answer to a path that reaches no loader (`/ready`, a 404), so `y`'s count starts at 0.
// ASSUMED: (1) "gets 200" is the status the loader read from the response and returned; (2) the headers the unsafe code sets are `Sec-Fetch-Site: none` alone, `Host` being the one the URL gives.
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Node, REMOVE, buildProject, freePort, startNode, value } from "./local-routes-build-support.ts";

const CONFIG = {
  "topology.ts":
    'import { topology } from "@keel/server";\nexport default topology({ x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } });\n',
  "modules/a/module.ts":
    'import { module } from "@keel/compiler";\nexport default module({ id: "a", deps: [], capabilities: ["net"], public: { exports: [] } });\n',
  "modules/a/a.contract.ts":
    'import { contract } from "@keel/router/contract";\nimport { Peek } from "./Peek.schema.ts";\nexport const a = contract("a", { "a.peek": { method: "GET", path: "/api/peek", output: Peek } });\n',
  "modules/a/Peek.schema.ts": 'import { s } from "@keel/schema";\nexport const Peek = s.object({ status: s.int() });\n',
  "modules/a/peek.server.ts":
    'import { loader } from "@keel/router";\nimport { ok } from "@keel/schema";\nimport { a } from "./a.contract.ts";\nimport { reachPeer } from "./unsafe/reachPeer.ts";\nexport const peek = loader(a, "a.peek", {}, async (_args, ctx) => ok({ status: await reachPeer(ctx) }));\n',
  "modules/a/unsafe/reachPeer.ts": `type Net = { net: { fetch(req: Request): Promise<Response> } };
function unsafe<T>(reason: string, fn: () => T): T {
  return fn();
}
export async function reachPeer(ctx: Net): Promise<number> {
  return unsafe("a loopback fetch of a peer on this machine with headers this code sets", async () => {
    const proc: unknown = Reflect.get(globalThis, "process");
    const env: unknown = typeof proc === "object" && proc !== null ? Reflect.get(proc, "env") : undefined;
    const base: unknown = typeof env === "object" && env !== null ? Reflect.get(env, "KEEL_PEER_Y") : undefined;
    const res = await ctx.net.fetch(new Request(\`\${String(base)}/tools\`, { headers: { "sec-fetch-site": "none" } }));
    return res.status;
  });
}
`,
  "modules/a/routes.ts":
    'import { manifest } from "@keel/router";\nimport { a } from "./a.contract.ts";\nimport { peek } from "./peek.server.ts";\nexport const routes = manifest(a, { "a.peek": { loader: peek } });\n',
  "modules/b/module.ts":
    'import { module } from "@keel/compiler";\nexport default module({ id: "b", deps: [], capabilities: [], public: { exports: [] } });\n',
  "modules/b/b.contract.ts":
    'import { contract } from "@keel/router/contract";\nimport { Counts } from "./Counts.schema.ts";\nexport const b = contract("b", {\n  "b.tools": { path: "/tools", local: true },\n  "b.counts": { method: "GET", path: "/api/counts", output: Counts },\n});\n',
  "modules/b/Counts.schema.ts":
    'import { s } from "@keel/schema";\nexport const Counts = s.object({ tools: s.int() });\n',
  "modules/b/Tools.schema.ts":
    'import { s } from "@keel/schema";\nexport const Tools = s.object({ marker: s.string() });\n',
  "modules/b/state.server.ts": "export const state = { tools: 0 };\n",
  "modules/b/Tools.tsx":
    'import { Box, Text } from "@keel/ui";\nexport default function Tools() {\n  return <Box><Text id="b.tools.text">tools</Text></Box>\n}\n',
  "modules/b/tools.server.ts":
    'import { loader } from "@keel/router";\nimport { ok } from "@keel/schema";\nimport { b } from "./b.contract.ts";\nimport { Tools } from "./Tools.schema.ts";\nimport { state } from "./state.server.ts";\nexport const tools = loader(b, "b.tools", { output: Tools }, async () => {\n  state.tools += 1;\n  return ok({ marker: "tools" });\n});\n',
  "modules/b/counts.server.ts":
    'import { loader } from "@keel/router";\nimport { ok } from "@keel/schema";\nimport { b } from "./b.contract.ts";\nimport { state } from "./state.server.ts";\nexport const counts = loader(b, "b.counts", {}, async () => ok({ ...state }));\n',
  "modules/b/routes.ts":
    'import { manifest } from "@keel/router";\nimport { b } from "./b.contract.ts";\nimport Tools from "./Tools.tsx";\nimport { counts } from "./counts.server.ts";\nimport { tools } from "./tools.server.ts";\nexport const routes = manifest(b, { "b.tools": { component: Tools, loader: tools }, "b.counts": { loader: counts } });\n',
};

let root = "";
let x: Node | undefined;
let y: Node | undefined;
const up = (n: Node | undefined): Node => {
  if (n === undefined) throw new Error("server not started");
  return n;
};
beforeAll(async () => {
  const b = buildProject(CONFIG);
  root = b.root;
  expect(b.status, b.out).toBe(0);
  const [px, py] = [await freePort(), await freePort()];
  const peers = { KEEL_PEER_X: `http://127.0.0.1:${px}`, KEEL_PEER_Y: `http://127.0.0.1:${py}` };
  y = await startNode(root, "y", py, peers, "/api/counts");
  x = await startNode(root, "x", px, peers, "/ready");
}, fixedTime(600_000));
afterAll(() => {
  x?.stop();
  y?.stop();
  REMOVE(root);
});

describe("k.contract Local routes: the app's own loopback `ctx.net.fetch` reaches a peer's `local` route", () => {
  it(
    "`ctx.net.fetch` of `y`'s `local: true` page at `http://127.0.0.1:<port>/tools` with `Sec-Fetch-Site: none`, from `unsafe` code in a loader of `x`, both `server.mjs`, gets 200",
    async () => {
      const got = await value(up(x).port, "/api/peek", "a.peek");
      expect(got, `${up(x).out().slice(-300)}`).toEqual({ status: 200 });
    },
    fixedTime(120_000),
  );

  it(
    "`y`'s loader runs once",
    async () => {
      expect(await value(up(y).port, "/api/counts", "b.counts")).toEqual({ tools: 1 });
    },
    fixedTime(120_000),
  );
});
