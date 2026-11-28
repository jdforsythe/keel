// @vitest-environment node
// Spec: std.sessions, clause "A valid session posted to `sessions.ingest` with `qwertyuiopasdfgh` as a store's `state` is listed by `sessions.list` with that `state`."
// Seed 1337
// Reading: "listed by `sessions.list` with that `state`" is the archive entry's recorded session holding `state[<store>]` equal to the posted value, for the reader the readers config names (as ingest-list.test.ts does).
import { createHash } from "node:crypto";
import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import { Session } from "@keel/std-sessions";
import { routes } from "@keel/std-sessions/routes";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const hashOf = (value: string): string => createHash("sha256").update(value).digest("base64url");
const field = (v: unknown, k: string): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined);

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

function make(state: unknown, route: { params: unknown; search: unknown }): Session {
  const error = { code: "usr.bad", message: "failed", data: null };
  const parsed = Session.parse({
    v: 1,
    id: "s-1",
    seed: 1337,
    deterministic: true,
    at: 1000,
    route: { id: "cart.show", ...route },
    state,
    events: [{ at: 1000, kind: "error", route: "cart.show", error }],
    error,
    fingerprint: "client-claimed",
  });
  if (!parsed.ok) throw new Error("fixture session does not parse");
  return parsed.value;
}

async function listed(state: unknown, route: { params: unknown; search: unknown }): Promise<unknown[]> {
  const { app, ctx } = await boot();
  const post = await app.fetch(
    new Request("http://localhost/sessions", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(Session.encode(make(state, route))),
    }),
  );
  expect(post.status).toBe(200);
  const m = /keel-caller=([^;]+)/.exec(post.headers.get("set-cookie") ?? "");
  const caller = m?.[1] ?? "";
  bindStd(ctx, { "@keel/std-sessions": { sessions: { readers: [hashOf(caller)] } } });
  const res = await app.fetch(
    new Request("http://localhost/sessions/list", {
      headers: { accept: "application/json", cookie: `keel-caller=${caller}` },
      redirect: "manual",
    }),
  );
  const body: unknown = await res.json();
  const result = field(field(body, "results"), "sessions.list");
  expect(field(result, "ok")).toBe(true);
  const archive = field(result, "value");
  return Object.values(Object(archive)).flatMap((entry) => {
    const sessions = field(entry, "sessions");
    return Array.isArray(sessions) ? sessions : [];
  });
}

describe("std.sessions: sessions.ingest redacts nothing", () => {
  test("a valid session posted to sessions.ingest with 'qwertyuiopasdfgh' as a store's state is listed by sessions.list with that state", async () => {
    const out = await listed({ cart: "qwertyuiopasdfgh" }, { params: {}, search: {} });
    expect(out).toHaveLength(1);
    expect(field(field(out[0], "state"), "cart")).toBe("qwertyuiopasdfgh");
  });

  test("for every generated JSON state, params and search, the listed session holds them as posted", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.dictionary(fc.stringMatching(/^[a-z]{1,8}$/), fc.jsonValue(), { maxKeys: 3 }),
        fc.dictionary(fc.stringMatching(/^[a-z]{1,8}$/), fc.string(), { maxKeys: 3 }),
        async (state, search) => {
          const out = await listed(state, { params: { id: "qwertyuiopasdfgh" }, search });
          expect(out).toHaveLength(1);
          expect(JSON.parse(JSON.stringify(field(out[0], "state")))).toEqual(JSON.parse(JSON.stringify(state)));
          expect(field(field(out[0], "route"), "search")).toEqual(search);
          expect(field(field(field(out[0], "route"), "params"), "id")).toBe("qwertyuiopasdfgh");
        },
      ),
      { seed: 1337, numRuns: 12 },
    );
  });
});
