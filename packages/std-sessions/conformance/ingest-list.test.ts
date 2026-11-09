// Spec: std.sessions, clause "A valid POST to `sessions.ingest` is listed under its fingerprint; invalid input is 422 `keel.fields`; a sixth of one fingerprint keeps 5, counts 6; a caller not in `readers` is redirected."
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
type Entry = { count: number; first: number; last: number; sessions: unknown[] };

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

function make(id: string, code: string): Session {
  const error = { code, message: `failed ${code}`, data: null };
  const parsed = Session.parse({
    v: 1,
    id,
    seed: 1337,
    deterministic: true,
    at: 1000,
    route: { id: "cart.show", params: {}, search: {} },
    state: {},
    events: [{ at: 1000, kind: "error", route: "cart.show", error }],
    error,
    fingerprint: "client-claimed",
  });
  if (!parsed.ok) throw new Error("fixture session does not parse");
  return parsed.value;
}

function post(app: Fetcher, body: string, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/json", "content-type": "application/json" };
  if (cookie !== undefined) headers.cookie = `keel-caller=${cookie}`;
  return app.fetch(new Request("http://localhost/sessions", { method: "POST", headers, body }));
}

const send = (app: Fetcher, session: Session, cookie?: string): Promise<Response> =>
  post(app, JSON.stringify(Session.encode(session)), cookie);

function callerValue(res: Response): string {
  const m = /keel-caller=([^;]+)/.exec(res.headers.get("set-cookie") ?? "");
  if (m === null || m[1] === undefined) throw new Error("no caller cookie minted");
  return m[1];
}

const hashOf = (value: string): string => createHash("sha256").update(value).digest("base64url");

const list = (app: Fetcher, cookie: string): Promise<Response> =>
  app.fetch(
    new Request("http://localhost/sessions/list", {
      headers: { accept: "application/json", cookie: `keel-caller=${cookie}` },
      redirect: "manual",
    }),
  );

async function archiveOf(res: Response): Promise<Record<string, Entry>> {
  const body: unknown = await res.json();
  const result: unknown = Reflect.get(Object(Reflect.get(Object(body), "results")), "sessions.list");
  expect(Reflect.get(Object(result), "ok")).toBe(true);
  const value: unknown = Reflect.get(Object(result), "value");
  const out: Record<string, Entry> = {};
  for (const key of Object.keys(Object(value))) {
    const entry: unknown = Reflect.get(Object(value), key);
    const count = Reflect.get(Object(entry), "count");
    const first = Reflect.get(Object(entry), "first");
    const last = Reflect.get(Object(entry), "last");
    const sessions = Reflect.get(Object(entry), "sessions");
    if (
      typeof count !== "number" ||
      typeof first !== "number" ||
      typeof last !== "number" ||
      !Array.isArray(sessions)
    ) {
      throw new Error("archive entry has the wrong shape");
    }
    out[key] = { count, first, last, sessions };
  }
  return out;
}

const codeArb = fc.stringMatching(/^[A-Z][A-Z0-9_]{2,10}$/);
const allow = (ctx: ReturnType<typeof createCtx>, caller: string) =>
  bindStd(ctx, { "@keel/std-sessions": { sessions: { readers: [hashOf(caller)] } } });

describe("std.sessions: ingest", () => {
  test("A valid POST to `sessions.ingest` is listed by `sessions.list` under its fingerprint", async () => {
    await fc.assert(
      fc.asyncProperty(codeArb, async (code) => {
        const { app, ctx } = await boot();
        const first = await send(app, make("s-1", code));
        expect(first.status).toBe(200);
        expect(await first.json()).toEqual({ ok: true, value: null });
        const caller = callerValue(first);
        allow(ctx, caller);
        const archive = await archiveOf(await list(app, caller));
        const keys = Object.keys(archive);
        expect(keys).toHaveLength(1);
        const key = keys[0] ?? "";
        expect(archive[key]?.count).toBe(1);
        expect(archive[key]?.sessions).toHaveLength(1);
        // Same error and route: same fingerprint. Another error code: another one.
        await send(app, make("s-2", code), caller);
        await send(app, make("s-3", `${code}X`), caller);
        const after = await archiveOf(await list(app, caller));
        expect(Object.keys(after)).toHaveLength(2);
        expect(after[key]?.count).toBe(2);
      }),
      { seed: 1337, numRuns: 8 },
    );
  });

  test("invalid input is 422 `keel.fields`", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("{}", `{"v":2}`, `{"v":1,"id":5}`, "[]", `{"v":1,"extra":true}`),
        async (body) => {
          const { app } = await boot();
          const res = await post(app, body);
          expect(res.status).toBe(422);
          const parsed: unknown = await res.json();
          expect(Reflect.get(Object(parsed), "ok")).toBe(false);
          expect(Reflect.get(Object(Reflect.get(Object(parsed), "error")), "code")).toBe("keel.fields");
        },
      ),
      { seed: 1337, numRuns: 5 },
    );
  });

  test("a sixth session of one fingerprint keeps 5 and counts 6", async () => {
    await fc.assert(
      fc.asyncProperty(codeArb, async (code) => {
        const { app, ctx } = await boot();
        const caller = callerValue(await send(app, make("s-0", code)));
        for (let i = 1; i < 6; i++) expect((await send(app, make(`s-${i}`, code), caller)).status).toBe(200);
        allow(ctx, caller);
        const entries = Object.values(await archiveOf(await list(app, caller)));
        expect(entries).toHaveLength(1);
        expect(entries[0]?.count).toBe(6);
        expect(entries[0]?.sessions).toHaveLength(5);
      }),
      { seed: 1337, numRuns: 4 },
    );
  });

  test("a caller not in `readers` is redirected to `sessions.ingest`", async () => {
    await fc.assert(
      fc.asyncProperty(codeArb, async (code) => {
        const { app, ctx } = await boot();
        const writer = callerValue(await send(app, make("s-1", code)));
        allow(ctx, `${writer}-someone-else`);
        const res = await list(app, writer);
        expect(res.status).toBe(302);
        const location = res.headers.get("location") ?? "";
        expect(location.startsWith("/sessions?")).toBe(true);
        expect(new URL(location, "http://localhost").searchParams.has("next")).toBe(true);
        expect(await res.text()).not.toContain("failed");
      }),
      { seed: 1337, numRuns: 4 },
    );
  });
});
