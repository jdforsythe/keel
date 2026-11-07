// @vitest-environment happy-dom
// Spec: k.server Conformance: A loader's `url` is the absolute URL of the request it serves.
// Seed 1337.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { expect, test } from "vitest";

const Out = s.object({ title: s.string() });

async function setup() {
  const seen: string[] = [];
  const load = loader({ output: Out }, async ({ url }) => {
    seen.push(url);
    return ok({ title: "t" });
  });
  const routes = manifest({
    "app.page": { path: "/where", loader: load, component: () => document.createElement("p") },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
  });
  return { app, seen };
}

test("A loader's `url` is the absolute URL of the request it serves (runtime request)", async () => {
  const { app, seen } = await setup();
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z0-9]{1,10}$/), async (q) => {
      seen.length = 0;
      const full = `http://localhost/where?q=${q}`;
      const res = await app.fetch(new Request(full, { headers: { accept: "application/json" } }));
      expect(res.status).toBe(200);
      expect(seen).toEqual([full]);
      expect(new URL(seen[0] ?? "").origin).toBe("http://localhost");
    }),
    { seed: 1337, numRuns: 25 },
  );
});

test("A loader's `url` is the absolute URL of the request it serves (document request)", async () => {
  const { app, seen } = await setup();
  const full = "http://localhost/where?q=1";
  const res = await app.fetch(new Request(full));
  expect(res.status).toBe(200);
  expect(seen).toEqual([full]);
});
