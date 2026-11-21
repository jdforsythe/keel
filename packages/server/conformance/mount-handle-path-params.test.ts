// Spec: rfc:0156 (k.mount-scope names `createApp` `handle.path`), clause "`createApp` with `handle.path` `/api/auth` and a page `/:locale/:slug` starts; a GET of `/api/auth/session` reaches `handle.fn`, and a GET of `/en/about` renders the page."
// Spec: k.mount-scope Test "with `path` `/api/auth`, `/%61pi/auth` is under it, and the server answers it 404 without `handle`."
// Spec: k.mount-scope Conformance "the server answers `/%67ate` 404 without calling `handle`."
// Seed 1337 (fc.assert below).
// @vitest-environment node
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const BASE = "http://localhost";
const SECRET = "conformance-secret-user-0123456789abcdef0123456789abcdef";

async function start() {
  const calls: string[] = [];
  const appContract = contract("app", {
    "app.page": { path: "/:locale/:slug", params: s.object({ locale: s.string(), slug: s.string() }) },
  });
  const routes = manifest(appContract, {
    "app.page": {
      component: () => {
        const p = document.createElement("p");
        p.textContent = "locale-slug-page";
        return p;
      },
    },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "production",
    secret: SECRET,
    identity: identity({
      identify: async () => "u1",
      handle: {
        path: "/api/auth",
        fn: (request) => {
          calls.push(new URL(request.url).pathname);
          return new Response("from-fn", { status: 200 });
        },
      },
    }),
  });
  return { app, calls };
}
const get = (app: Awaited<ReturnType<typeof start>>["app"], path: string) =>
  app.fetch(new Request(`${BASE}${path}`, { headers: { accept: "text/html" } }));

describe("k.mount: handle.path beside a :param page", () => {
  test("createApp with handle.path /api/auth and a page /:locale/:slug starts", async () => {
    const { app } = await start();
    expect(app).toBeDefined();
  });

  test("a GET of /api/auth/session reaches handle.fn, and a GET of /en/about renders the page", async () => {
    const { app, calls } = await start();
    const session = await get(app, "/api/auth/session");
    expect(await session.text()).toBe("from-fn");
    expect(calls).toEqual(["/api/auth/session"]);
    const page = await get(app, "/en/about");
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("locale-slug-page");
    expect(calls).toEqual(["/api/auth/session"]);
  });

  test("for generated locale and slug segments not under the mount, a GET renders the page and never reaches fn", async () => {
    const { app, calls } = await start();
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{2,5}$/), fc.stringMatching(/^[a-z]{1,6}$/), async (l, s) => {
        fc.pre(l !== "api");
        const res = await get(app, `/${l}/${s}`);
        expect(await res.text()).toContain("locale-slug-page");
      }),
      { seed: SEED, numRuns: 20 },
    );
    expect(calls).toEqual([]);
  });

  test("a GET of /%61pi/auth and of /api/%61uth is 404 and fn does not run", async () => {
    const { app, calls } = await start();
    for (const path of ["/%61pi/auth", "/api/%61uth", "/%61pi/auth/session"]) {
      const res = await get(app, path);
      expect(res.status, path).toBe(404);
    }
    expect(calls).toEqual([]);
  });
});
