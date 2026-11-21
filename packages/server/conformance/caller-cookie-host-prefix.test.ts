// Spec: k.security, clause "On https the caller cookie is `__Host-keel-caller`; a `keel-caller` there counts as none."
// Seed 1337 (no generated inputs). Runs under plain Node: happy-dom strips cookie headers. Runtime (JSON) requests only.
// @vitest-environment node
import { createHash } from "node:crypto";
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { expect, test } from "vitest";

const Out = s.object({ caller: s.string() });
const Nothing = s.object({});
const hash = (value: string): string => createHash("sha256").update(value).digest("base64url");

async function setup(secure?: boolean) {
  const seen: { loader: string | undefined; action: string | undefined } = { loader: undefined, action: undefined };
  const appContract = contract("app", {
    "app.who": { path: "/who" },
  });

  const read = loader(appContract, "app.who", { output: Out }, async ({ caller }) => {
    seen.loader = caller;
    return ok({ caller });
  });
  const write = action(appContract, "app.who", { input: Nothing }, async (_input, { caller }) => {
    seen.action = caller;
    return ok(null);
  });
  const routes = manifest(appContract, {
    "app.who": { loader: read, component: () => document.createElement("p"), POST: write },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
    ...(secure === undefined ? {} : { secure }),
  });
  const get = (origin: string, cookie?: string): Promise<Response> =>
    app.fetch(
      new Request(`${origin}/who`, {
        headers: { accept: "application/json", ...(cookie === undefined ? {} : { cookie }) },
      }),
    );
  const post = (origin: string, cookie?: string): Promise<Response> =>
    app.fetch(
      new Request(`${origin}/who`, {
        method: "POST",
        body: "{}",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          origin,
          ...(cookie === undefined ? {} : { cookie }),
        },
      }),
    );
  return { seen, get, post };
}

const HTTPS = "https://example.test";
const HTTP = "http://localhost";

/** [name, value, attributes (lowercased)] of the response's set-cookie. */
function cookieOf(res: Response): { name: string; value: string; attrs: string[] } {
  const header = res.headers.get("set-cookie");
  if (header === null) throw new Error("expected a set-cookie header");
  const parts = header.split(";").map((p) => p.trim());
  const first = parts[0] ?? "";
  const eq = first.indexOf("=");
  return { name: first.slice(0, eq), value: first.slice(eq + 1), attrs: parts.slice(1).map((p) => p.toLowerCase()) };
}

test("On https the caller cookie is `__Host-keel-caller` (Secure, Path=/, HttpOnly, SameSite=Lax, no Domain) on a cookieless write", async () => {
  const { seen, post } = await setup();
  const res = await post(HTTPS);
  expect(res.status).toBe(200);
  const c = cookieOf(res);
  expect(c.name).toBe("__Host-keel-caller");
  expect(c.value).not.toBe("");
  expect(c.attrs).toContain("secure");
  expect(c.attrs).toContain("path=/");
  expect(c.attrs).toContain("httponly");
  expect(c.attrs).toContain("samesite=lax");
  expect(c.attrs.some((a) => a.startsWith("domain"))).toBe(false);
  expect(seen.action).toBe(hash(c.value));
});

test("On https a `__Host-keel-caller` sent back keeps the caller (loader and action, no new set-cookie)", async () => {
  const { seen, get, post } = await setup();
  const c = cookieOf(await post(HTTPS));
  const r = await get(HTTPS, `__Host-keel-caller=${c.value}`);
  expect(r.status).toBe(200);
  expect(seen.loader).toBe(hash(c.value));
  expect(r.headers.get("set-cookie")).toBeNull();
  const w = await post(HTTPS, `__Host-keel-caller=${c.value}`);
  expect(seen.action).toBe(hash(c.value));
  expect(w.headers.get("set-cookie")).toBeNull();
});

test('On https a `keel-caller` counts as none: a read gets `""`, a write gets a fresh `__Host-keel-caller`', async () => {
  const { seen, get, post } = await setup();
  const issued = cookieOf(await post(HTTPS));
  const r = await get(HTTPS, `keel-caller=${issued.value}`);
  expect(r.status).toBe(200);
  expect(seen.loader).toBe("");
  expect(r.headers.get("set-cookie")).toBeNull();
  const w = await post(HTTPS, `keel-caller=${issued.value}`);
  const fresh = cookieOf(w);
  expect(fresh.name).toBe("__Host-keel-caller");
  expect(fresh.value).not.toBe(issued.value);
  expect(seen.action).toBe(hash(fresh.value));
  expect(seen.action).not.toBe(hash(issued.value));
});

test("backlog 0134: a planted keel-caller cookie (sibling subdomain) is not adopted on https", async () => {
  const { seen, get, post } = await setup();
  const planted = "planted-by-sibling-0123456789abcdef";
  await get(HTTPS, `keel-caller=${planted}`);
  expect(seen.loader).toBe("");
  const w = await post(HTTPS, `keel-caller=${planted}`);
  const fresh = cookieOf(w);
  expect(fresh.name).toBe("__Host-keel-caller");
  expect(seen.action).toBe(hash(fresh.value));
  expect(seen.action).not.toBe(hash(planted));
});

test("With createApp({ secure: true }) an http:// request URL (TLS-terminating proxy) gets `__Host-keel-caller` with Secure", async () => {
  const { seen, get, post } = await setup(true);
  const res = await post(HTTP);
  const c = cookieOf(res);
  expect(c.name).toBe("__Host-keel-caller");
  expect(c.attrs).toContain("secure");
  expect(c.attrs).toContain("path=/");
  expect(c.attrs.some((a) => a.startsWith("domain"))).toBe(false);
  expect(seen.action).toBe(hash(c.value));
  await get(HTTP, `__Host-keel-caller=${c.value}`);
  expect(seen.loader).toBe(hash(c.value));
  await get(HTTP, `keel-caller=${c.value}`);
  expect(seen.loader).toBe("");
});

test("Over http without `secure` the caller cookie is `keel-caller` and not Secure", async () => {
  const { seen, post } = await setup();
  const res = await post(HTTP);
  const c = cookieOf(res);
  expect(c.name).toBe("keel-caller");
  expect(c.attrs).not.toContain("secure");
  expect(c.attrs).toContain("httponly");
  expect(c.attrs).toContain("samesite=lax");
  expect(c.attrs).toContain("path=/");
  expect(seen.action).toBe(hash(c.value));
});
