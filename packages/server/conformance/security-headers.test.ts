// Spec: k.security, Conformance "Every `createApp` response, a 404, a 413 and an asset included, carries the six headers; `Strict-Transport-Security` only on https."
// Seed: 1337.
// @vitest-environment happy-dom
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";

const SIX: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), payment=(), usb=()",
};
const HSTS = "max-age=63072000";
const Edit = s.object({ note: s.string() });

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

function distDir(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-sec-headers-")));
  roots.push(root);
  const dist = path.join(root, "dist", "web");
  fs.mkdirSync(path.join(dist, ".vite"), { recursive: true });
  fs.mkdirSync(path.join(dist, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(dist, ".vite", "manifest.json"),
    JSON.stringify({ "entry.ts": { file: "assets/entry-B1x2Y3z4.js", isEntry: true } }),
  );
  fs.writeFileSync(path.join(dist, "assets", "entry-B1x2Y3z4.js"), "export const resume = 1;\n");
  return dist;
}

async function setup(
  opts: { secure?: boolean; maxBodyBytes?: number; mode?: "dev" | "production"; assets?: string } = {},
) {
  const appContract = contract("app", {
    "app.home": { path: "/" },
    "app.edit": { path: "/edit" },
  });

  const act = action(appContract, "app.edit", { input: Edit }, () => Promise.resolve(ok(null)));
  const routes = manifest(appContract, {
    "app.home": { component: () => document.createElement("main") },
    "app.edit": { component: () => document.createElement("main"), POST: act },
  });
  return createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: opts.mode ?? "production",
    ...(opts.secure === undefined ? {} : { secure: opts.secure }),
    ...(opts.maxBodyBytes === undefined ? {} : { maxBodyBytes: opts.maxBodyBytes }),
    ...(opts.assets === undefined ? {} : { assets: opts.assets }),
  });
}

function expectSix(res: Response): void {
  for (const [name, value] of Object.entries(SIX)) expect(res.headers.get(name)).toBe(value);
}

describe("k.security: the six headers", () => {
  test("Every `createApp` response, a 404, a 413 and an asset included, carries the six headers", async () => {
    const dist = distDir();
    const app = await setup({ maxBodyBytes: 16, assets: dist });
    const responses: Response[] = [
      await app.fetch(new Request("http://localhost/")),
      await app.fetch(new Request("http://localhost/", { headers: { accept: "application/json" } })),
      await app.fetch(new Request("http://localhost/nope")),
      await app.fetch(
        new Request("http://localhost/edit", {
          method: "POST",
          body: JSON.stringify({ note: "x".repeat(64) }),
          headers: { "content-type": "application/json", accept: "application/json" },
        }),
      ),
      await app.fetch(new Request("http://localhost/assets/entry-B1x2Y3z4.js")),
    ];
    expect(responses.map((r) => r.status).slice(2, 4)).toEqual([404, 413]);
    expect(responses[4]?.status).toBe(200);
    for (const res of responses) expectSix(res);
  });

  test("property: any unrouted path is a 404 that carries the six headers", async () => {
    const app = await setup();
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{3,12}$/), async (seg) => {
        const res = await app.fetch(new Request(`http://localhost/zz-${seg}`));
        expect(res.status).toBe(404);
        expectSix(res);
      }),
      { seed: 1337, numRuns: 25 },
    );
  });

  test("`Strict-Transport-Security` is `max-age=63072000` on https", async () => {
    const app = await setup();
    for (const p of ["/", "/nope"]) {
      const res = await app.fetch(new Request(`https://example.test${p}`));
      expect(res.headers.get("strict-transport-security")).toBe(HSTS);
      expectSix(res);
    }
  });

  test("`Strict-Transport-Security` is absent over http", async () => {
    const app = await setup();
    for (const p of ["/", "/nope"]) {
      const res = await app.fetch(new Request(`http://localhost${p}`));
      expect(res.headers.get("strict-transport-security")).toBeNull();
    }
  });

  test("`Strict-Transport-Security` follows the cookie's https rule: `secure: true` over an http URL carries it", async () => {
    const app = await setup({ secure: true });
    const res = await app.fetch(new Request("http://localhost/"));
    expect(res.headers.get("strict-transport-security")).toBe(HSTS);
  });
});
