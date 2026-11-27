// `keel dev` routes a request the way the built server does (k.topology Local topology, k.user): a path at or under
// a dev app's identity `handle.path` goes to that app, as does a path one of its routes matches; anything else goes
// on to Vite.
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, describe, expect, it } from "vitest";
import { devEntryCode } from "../src/internal/devEntryCode.ts";
import { devMiddleware } from "../src/internal/devMiddleware.ts";

let server: http.Server | undefined;
afterEach(async () => {
  await new Promise<void>((resolve) => (server === undefined ? resolve() : server.close(() => resolve())));
  server = undefined;
});

/** One dev app with a route at `/api/me` and the identity mount at `/api/auth`, behind the middleware; Vite says `vite`. */
async function listen(): Promise<{ base: string; seen: string[] }> {
  const seen: string[] = [];
  const app = {
    fetch: async (req: Request) => {
      seen.push(`${req.method} ${new URL(req.url).pathname} ${await req.text()}`);
      return new Response("app", { status: 201 });
    },
  };
  const mw = devMiddleware(async () => [{ app, served: (p: string) => p === "/api/me", mount: "/api/auth" }]);
  server = http.createServer((req, res) =>
    mw.handle(req, res, () => {
      res.writeHead(404);
      res.end("vite");
    }),
  );
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address: AddressInfo | string | null | undefined = server?.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return { base: `http://127.0.0.1:${port}`, seen };
}

describe("devMiddleware", () => {
  it("sends a request at or under the identity mount to the app, with its body", async () => {
    const { base, seen } = await listen();
    const post = await fetch(`${base}/api/auth/sign-up/email`, { method: "POST", body: "x=1" });
    expect([post.status, await post.text()]).toEqual([201, "app"]);
    const get = await fetch(`${base}/api/auth`);
    expect([get.status, await get.text()]).toEqual([201, "app"]);
    expect(seen).toEqual(["POST /api/auth/sign-up/email x=1", "GET /api/auth "]);
  });

  it("sends a routed path to the app and anything else, a sibling of the mount included, to Vite", async () => {
    const { base, seen } = await listen();
    expect((await fetch(`${base}/api/me`)).status).toBe(201);
    for (const p of ["/api/authx", "/api", "/assets/a.js"]) {
      const r = await fetch(`${base}${p}`);
      expect([p, r.status, await r.text()]).toEqual([p, 404, "vite"]);
    }
    expect(seen).toEqual(["GET /api/me "]);
  });
});

describe("devEntryCode", () => {
  it("gives each dev app the identity source's handle path, or undefined without identity.server.ts", () => {
    const root = tempDir(".tmp-dev-mount-", import.meta.dirname);
    try {
      const topology = { api: { modules: [], adapter: "node" as const } };
      expect(devEntryCode(root, topology)).toContain("(p) => matchUrl(table, p).route !== null, undefined]);");
      fs.writeFileSync(path.join(root, "identity.server.ts"), "export default {};\n");
      expect(devEntryCode(root, topology)).toContain(
        "(p) => matchUrl(table, p).route !== null, identity.handle?.path]);",
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
