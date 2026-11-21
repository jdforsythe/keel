// @vitest-environment node
// k.privacy Server log: a path a front server forwards to a peer deployable is marked in the front's `req` line by the
// peer's routes in the manifest, so a value sent for the peer route's secret param is `[secret]` there too. Two
// deployables: the front `x` serves module `a`, the peer `y` serves module `b`. Seed 1337; the peer answers through sim
// net routes.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const SEED = 1337;
const ca = contract("a", { "a.home": { path: "/a" } });
const cb = contract("b", { "b.reset": { path: "/b/reset/:token", params: s.object({ token: s.secret(s.string()) }) } });
const PEER = "http://y.internal:8080";
/** Never rendered: the front answers `/a` with no request here and forwards the peer's path. */
const view = (): Node => document.createElement("p");

/** `routes.json` in a fresh artifacts directory: `y`'s module `b` serves `/b/reset/:token`. */
function artifacts(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-req-forwarded-"));
  const data = { "b.reset": { module: "b", path: "/b/reset/:token" } };
  fs.writeFileSync(path.join(dir, "routes.json"), JSON.stringify({ data, hash: "" }));
  return dir;
}

describe("a forwarded path in the front server's req line", () => {
  it("is [secret] where the peer's route has a secret param", async () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    ctx.net.route("*", () => new Response("ok", { status: 200 }));
    const lines: string[] = [];
    const app = await createApp({
      topology: topology({ x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } }),
      deployable: "x",
      routes: routeTable(
        manifest(ca, { "a.home": { component: view } }),
        manifest(cb, { "b.reset": { component: view } }),
      ),
      ctx,
      peers: { y: PEER },
      artifacts: artifacts(),
      log: { format: "compact", write: (l) => void lines.push(l) },
    });
    const res = await app.fetch(new Request("http://localhost/b/reset/tok-9a8b7c6d5e4f"));
    await res.text();
    await app.close();
    expect(res.status).toBe(200);
    expect(lines.filter((l) => l.startsWith("GET "))).toEqual([expect.stringMatching(/^GET \/b\/reset\/\[secret\] /)]);
    for (const l of lines) expect(l).not.toContain("9a8b");
  });
});
