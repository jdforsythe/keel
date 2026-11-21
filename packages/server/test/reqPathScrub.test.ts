// @vitest-environment happy-dom
// k.privacy Server log: the `req` record's path goes through the same two passes as a `diag` message, after the
// handler settles: a secret param is `[secret]` in each written form the scrub matches, a personal-data value a loader
// output marks is `[pii]`, and a path no request scope made a value for is written as it came. Seed 1337.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const SEED = 1337;
const view = (): Node => document.createElement("main");
const c = contract("app", {
  "app.reset": { path: "/reset/:token", params: s.object({ token: s.secret(s.string()) }) },
  "app.both": {
    path: "/both/:slug/:token",
    params: s.object({ token: s.secret(s.string()), slug: s.string() }),
  },
});
const Person = loader(c, "app.both", { output: s.object({ name: s.string().pii("name") }) }, () =>
  Promise.resolve(ok({ name: "ada-lovelace" })),
);

async function pathOf(url: string): Promise<{ path: unknown; lines: string[] }> {
  const lines: string[] = [];
  const routes = manifest(c, {
    "app.reset": { component: view },
    "app.both": { loader: Person, component: view },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "production",
    log: { format: "json", write: (l) => void lines.push(l) },
  });
  await (await app.fetch(new Request(`http://localhost${url}`, { headers: { accept: "application/json" } }))).text();
  const req = lines
    .map((l): unknown => JSON.parse(l))
    .find((r) => typeof r === "object" && r !== null && Reflect.get(r, "kind") === "req");
  return { path: typeof req === "object" && req !== null ? Reflect.get(req, "path") : undefined, lines };
}

describe("the req path scrub", () => {
  it("marks a secret param written percent-encoded in the path", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^tok [a-z]{6,10}é$/), async (token) => {
        const { path, lines } = await pathOf(`/reset/${encodeURIComponent(token)}`);
        expect(path).toBe("/reset/[secret]");
        for (const l of lines) expect(l).not.toContain(encodeURIComponent(token));
      }),
      { seed: SEED, numRuns: 5 },
    );
  });

  it("marks a secret and a personal-data value in one path, each with its own mark", async () => {
    const { path } = await pathOf("/both/ada-lovelace/tok-9a8b7c6d");
    expect(path).toBe("/both/[pii]/[secret]");
  });

  it("writes a path no route matches as it came", async () => {
    const { path } = await pathOf("/nowhere/tok-9a8b7c6d");
    expect(path).toBe("/nowhere/tok-9a8b7c6d");
  });
});
