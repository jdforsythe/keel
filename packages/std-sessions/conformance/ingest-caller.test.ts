// Spec: std.sessions, clause "One caller's flood never evicts another caller's session; a POST naming another's `fingerprint` is filed under its own, the other's count unchanged."
// @vitest-environment node
// Seed 1337
import { createHash } from "node:crypto";
import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import { Session } from "@keel/std-sessions";
import { routes } from "@keel/std-sessions/routes";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

type Fetcher = { fetch(r: Request): Promise<Response> };
type Entry = { count: number; codes: string[] };

async function boot() {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const app = await createApp({
    topology: topology({ sessions: { modules: ["sessions"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
  });
  return { ctx, app };
}

/** A session that failed with `code` on `cart.show` (after a `nav` there with `nav`), claiming `fingerprint`. */
function make(id: string, code: string, fingerprint: string, blob = "", nav = false): Session {
  const error = { code, message: `failed ${code}`, data: null };
  const parsed = Session.parse({
    v: 1,
    id,
    seed: 1337,
    deterministic: true,
    at: 1000,
    route: { id: "cart.show", params: {}, search: {} },
    state: blob === "" ? {} : { blob },
    events: [
      ...(nav ? [{ at: 1000, kind: "nav", href: "/cart" }] : []),
      { at: 1000, kind: "error", route: "cart.show", error },
    ],
    error,
    fingerprint,
  });
  if (!parsed.ok) throw new Error("fixture session does not parse");
  return parsed.value;
}

function send(app: Fetcher, session: Session, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/json", "content-type": "application/json" };
  if (cookie !== undefined) headers.cookie = `keel-caller=${cookie}`;
  const body = JSON.stringify(Session.encode(session));
  return app.fetch(new Request("http://localhost/sessions", { method: "POST", headers, body }));
}

function callerValue(res: Response): string {
  const m = /keel-caller=([^;]+)/.exec(res.headers.get("set-cookie") ?? "");
  if (m === null || m[1] === undefined) throw new Error("no caller cookie minted");
  return m[1];
}

const hashOf = (value: string): string => createHash("sha256").update(value).digest("base64url");

/** `sessions.list` as a reader: per fingerprint, its count and the error codes of its kept sessions. */
async function listed(app: Fetcher, ctx: ReturnType<typeof createCtx>, cookie: string): Promise<Record<string, Entry>> {
  bindStd(ctx, { "@keel/std-sessions": { sessions: { readers: [hashOf(cookie)] } } });
  const res = await app.fetch(
    new Request("http://localhost/sessions/list", {
      headers: { accept: "application/json", cookie: `keel-caller=${cookie}` },
      redirect: "manual",
    }),
  );
  expect(res.status).toBe(200);
  const body: unknown = await res.json();
  const value: unknown = Reflect.get(
    Object(Reflect.get(Object(Reflect.get(Object(body), "results")), "sessions.list")),
    "value",
  );
  const out: Record<string, Entry> = {};
  for (const key of Object.keys(Object(value))) {
    const entry: unknown = Reflect.get(Object(value), key);
    const count = Reflect.get(Object(entry), "count");
    const sessions: unknown = Reflect.get(Object(entry), "sessions");
    if (typeof count !== "number" || !Array.isArray(sessions)) throw new Error("listing entry has the wrong shape");
    const codes = sessions.map((x: unknown) => String(Reflect.get(Object(Reflect.get(Object(x), "error")), "code")));
    out[key] = { count, codes };
  }
  return out;
}

const codeArb = fc.stringMatching(/^[A-Z][A-Z0-9_]{2,10}$/);

describe("std.sessions: ingest by caller", () => {
  test("One caller's flood never evicts another caller's session", async () => {
    // The backlog repro at its centre: one real POST, then about 20 POSTs of about 240 KiB with distinct codes.
    const flood = fc.record({
      posts: fc.integer({ min: 17, max: 22 }),
      size: fc.integer({ min: 200_000, max: 250_000 }),
      code: codeArb,
    });
    await fc.assert(
      fc.asyncProperty(flood, async ({ posts, size, code }) => {
        const { app, ctx } = await boot();
        const real = await send(app, make("real", code, ""));
        expect(real.status).toBe(200);
        const reader = callerValue(real);
        let flooder: string | undefined;
        for (let i = 0; i < posts; i++) {
          const res = await send(app, make(`f${i}`, `FLOOD${i}`, "", "a".repeat(size)), flooder);
          expect(res.status).toBe(200);
          flooder ??= callerValue(res);
        }
        const codes = Object.values(await listed(app, ctx, reader)).flatMap((e) => e.codes);
        expect(codes).toContain(code);
        expect(codes).toContain(`FLOOD${posts - 1}`);
        expect(codes.filter((c) => c.startsWith("FLOOD")).length).toBeLessThan(posts);
      }),
      { seed: 1337, numRuns: 3 },
    );
  }, 120_000);

  test("a POST naming another's `fingerprint` is filed under its own, the other's count unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(codeArb, async (code) => {
        const { app, ctx } = await boot();
        const caller = callerValue(await send(app, make("victim", code, "")));
        const before = await listed(app, ctx, caller);
        const [victim] = Object.keys(before);
        if (victim === undefined) throw new Error("victim not filed");
        for (const id of ["spoof-1", "spoof-2"])
          expect((await send(app, make(id, `${code}X`, victim, "", true), caller)).status).toBe(200);
        const after = await listed(app, ctx, caller);
        expect(after[victim]).toEqual({ count: 1, codes: [code] });
        const own = Object.keys(after).filter((k) => k !== victim);
        expect(own).toHaveLength(1);
        expect(after[own[0] ?? ""]).toEqual({ count: 2, codes: [`${code}X`, `${code}X`] });
      }),
      { seed: 1337, numRuns: 100 },
    );
  }, 60_000);
});
