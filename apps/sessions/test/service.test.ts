// @vitest-environment node
// The ingest service in plain node (no happy-dom), as `server.ts` serves it but over a sim ctx: the home page and the
// ingest page render with the deployable's title, an unknown path is a readable 404, a recorded session is ingested, a
// caller outside `readers` is sent to the ingest page, a reader lists the archive, and the module's `readers` entry
// reaches the guard through `.keel/std.json`. Seed 1337
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { bindStd } from "@keel/compiler/std/bindStd";
import { stdConfig } from "@keel/compiler/std/stdConfig";
import { createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { Session, SessionsConfig } from "@keel/std-sessions";
import { describe, expect, it } from "vitest";
import { routes } from "../modules/ops/routes.ts";
import topology from "../topology.ts";

const BASE = "http://localhost";
const STD = fileURLToPath(new URL("../.keel/std.json", import.meta.url));
/** The hash of the deployed service's reader cookie, as `modules/ops/module.ts` lists it. */
const READER = "h1NjuCrFnI-AX_1RSVPsvEjwe6-Em7G-6PDzHAqbRfA";

async function service(std?: string) {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const app = await createApp({ topology, routes, ctx, deployable: "sessions", ...(std === undefined ? {} : { std }) });
  return { ctx, app };
}

function recorded(n: number): Session {
  const error = { code: "cart.locked", message: "cart is locked", data: null };
  const r = Session.parse({
    v: 1,
    id: `session-${n}`,
    seed: 1337,
    deterministic: true,
    at: n,
    route: { id: "cart.show", params: {}, search: {} },
    state: { cart: { items: [] } },
    events: [{ at: n, kind: "error", route: "cart.show", error }],
    error,
    fingerprint: "",
  });
  if (!r.ok) throw new Error("fixture session does not parse");
  return r.value;
}

const page = async (fetch: (r: Request) => Promise<Response>, path: string) => {
  const res = await fetch(new Request(`${BASE}${path}`, { headers: { accept: "text/html" } }));
  return { status: res.status, html: await res.text() };
};
const ingest = (fetch: (r: Request) => Promise<Response>, s: Session, cookie = "") =>
  fetch(
    new Request(`${BASE}/sessions`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(Session.encode(s)),
    }),
  );
const list = (fetch: (r: Request) => Promise<Response>, cookie: string) =>
  fetch(new Request(`${BASE}/sessions/list`, { headers: { accept: "application/json", cookie }, redirect: "manual" }));

describe("apps/sessions in plain node", () => {
  it("has no DOM global before createApp", () => {
    expect(typeof document).toBe("undefined");
  });

  it("renders the home page and the ingest page", async () => {
    const { app } = await service();
    const home = await page(app.fetch, "/");
    expect(home.status).toBe(200);
    expect(home.html).toContain("Keel sessions");
    expect(home.html).toContain('href="/sessions"');
    const intro = await page(app.fetch, "/sessions");
    expect(intro.status).toBe(200);
    expect(intro.html).toContain('id="sessions.intro"');
  });

  it("titles every page with the deployable name; an unknown path is a readable 404", async () => {
    const { app } = await service();
    expect((await page(app.fetch, "/")).html).toContain("<title>sessions</title>");
    const missing = await page(app.fetch, "/no/such/page");
    expect(missing.status).toBe(404);
    expect(missing.html).toContain("<title>sessions</title>");
    expect(missing.html).toContain("<h1>Not found</h1>");
  });

  it("ingests a session; a caller outside readers is redirected to the ingest page; a reader lists it", async () => {
    const { ctx, app } = await service();
    const first = await ingest(app.fetch, recorded(1));
    expect(first.status).toBe(200);
    const token = /keel-caller=([^;]+)/.exec(first.headers.get("set-cookie") ?? "")?.[1] ?? "";
    const cookie = `keel-caller=${token}`;
    expect((await ingest(app.fetch, recorded(2), cookie)).status).toBe(200);

    const denied = await list(app.fetch, cookie);
    expect(denied.status).toBe(302);
    expect(denied.headers.get("location")).toMatch(/^\/sessions\?next=/);

    bindStd(ctx, {
      "@keel/std-sessions": { ops: { readers: [createHash("sha256").update(token).digest("base64url")] } },
    });
    const res = await list(app.fetch, cookie);
    expect(res.status).toBe(200);
    const body = JSON.stringify(await res.json());
    expect(body).toContain('"count":2');
    expect(body).toContain("cart.locked");
  });

  it("the module's readers entry reaches the service through .keel/std.json", async () => {
    const { ctx } = await service(STD);
    const readers = Object.values(stdConfig(ctx, "@keel/std-sessions", SessionsConfig)).flatMap((c) => c.readers ?? []);
    expect(readers).toEqual([READER]);
  });
});
