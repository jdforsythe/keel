// @vitest-environment node
// The loop guard (k.topology Calls and peers): a request carrying `x-keel-forwarded` is not forwarded but answered
// where it arrived, so through `x` to `y` to `z` no route of `z` is reached. Seed 1337; `z` is a sim net route.
import fs from "node:fs";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { type RouteTable, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { tempDir } from "@keel/tooling/test-tmp";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const SEED = 1337;
const T = topology({
  x: { modules: ["a"], adapter: "node" },
  y: { modules: ["b"], adapter: "node" },
  z: { modules: ["c"], adapter: "node" },
});

/** Module `id`'s one page at `/<id>`. */
function page(id: string): RouteTable {
  const c = contract(id, { [`${id}.p`]: { path: `/${id}` } });
  const load = loader(c, `${id}.p`, { output: s.object({ t: s.string() }) }, async () => ok({ t: id }));
  return manifest(c, { [`${id}.p`]: { loader: load, component: () => document.createElement("p") } });
}

/** `routes.json` in a fresh artifacts directory: module `module` serves `/c`. */
function artifacts(module: string): string {
  const dir = tempDir("keel-forward-chain-");
  const data = { [`${module}.c`]: { module, path: "/c" } };
  fs.writeFileSync(path.join(dir, "routes.json"), JSON.stringify({ data, hash: "" }));
  return dir;
}

/** `y` with its peer `z` at a URL serving `/c`; `seen` gets every request that reaches `z`. */
async function chain() {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const seen: Request[] = [];
  ctx.net.route("*", (req) => {
    seen.push(req);
    return new Response("z", { status: 200 });
  });
  const y = await createApp({
    topology: T,
    deployable: "y",
    routes: page("b"),
    ctx,
    peers: { z: "http://z.internal:8080" },
    artifacts: artifacts("c"),
  });
  const x = await createApp({
    topology: T,
    deployable: "x",
    routes: page("a"),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    peers: { y, z: "http://z.internal:8080" },
    artifacts: artifacts("b"),
  });
  return { x, y, seen };
}

describe("the loop guard", () => {
  it("forwards an unmarked request for /c from y to z", async () => {
    const { y, seen } = await chain();
    const res = await y.fetch(new Request("http://y.internal/c"));
    expect(await res.text()).toBe("z");
    expect(seen).toHaveLength(1);
  });

  it("answers a marked request for /c at y 404, and z gets no request", async () => {
    const { y, seen } = await chain();
    const res = await y.fetch(new Request("http://y.internal/c", { headers: { "x-keel-forwarded": "1" } }));
    expect(res.status).toBe(404);
    expect(seen).toHaveLength(0);
  });

  it("answers /c through x, which forwards it to y, 404, and z gets no request", async () => {
    const { x, seen } = await chain();
    const res = await x.fetch(new Request("http://x.internal/c"));
    expect(res.status).toBe(404);
    expect(seen).toHaveLength(0);
  });
});
