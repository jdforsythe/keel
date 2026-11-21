// @vitest-environment node
// Spec: std.contracts, Conformance "`@keel/std-sessions/contract` exports `sessions` of module `sessions` with API entries `sessions.ingest` (`POST /sessions`) and `sessions.list` (`GET /sessions/list`); `createApp` serving its `./routes` answers a `GET /sessions/list?since=x` (failing `ListSearch`) with 422 `keel.fields` and an issue at `query.since`."
// Spec: std.contracts, Conformance "`service({ contract: sessions })` has methods `ingest` and `list`, and `ingest` of a valid `Session` answers `ok({})`."
// Seed 1337 (no random input: fixed fixtures).
import { createHash } from "node:crypto";
import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import { service } from "@keel/services";
import { Session } from "@keel/std-sessions";
import { sessions } from "@keel/std-sessions/contract";
import { routes } from "@keel/std-sessions/routes";
import { describe, expect, test } from "vitest";

const entries = (): Record<string, unknown> =>
  typeof sessions.entries === "object" && sessions.entries !== null
    ? Object.fromEntries(Object.entries(sessions.entries))
    : {};
const rec = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? Object.fromEntries(Object.entries(v)) : {};

describe("std.contracts: std-sessions", () => {
  test("`@keel/std-sessions/contract` exports `sessions` of module `sessions` with API entries `sessions.ingest` (`POST /sessions`) and `sessions.list` (`GET /sessions/list`)", () => {
    expect(sessions.kind).toBe("keel.contract");
    expect(sessions.module).toBe("sessions");
    expect(Object.keys(entries()).sort()).toEqual(["sessions.ingest", "sessions.list", "sessions.tally"]);
    expect(rec(entries()["sessions.ingest"])).toMatchObject({ method: "POST", path: "/sessions" });
    expect(rec(entries()["sessions.list"])).toMatchObject({ method: "GET", path: "/sessions/list" });
  });

  test("`createApp` serving its `./routes` answers a `GET /sessions/list?since=x` (failing `ListSearch`) with 422 `keel.fields` and an issue at `query.since`", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const app = await createApp({
      topology: topology({ sessions: { modules: ["sessions"], adapter: "node" } }),
      routes,
      ctx,
      mode: "production",
      secret: "k".repeat(32),
    });
    // The reader guard runs before the query is decoded: a reader is a caller whose hash is in `readers`.
    const minted = await app.fetch(
      new Request("http://localhost/sessions", {
        method: "POST",
        body: "{}",
        headers: { accept: "application/json", "content-type": "application/json", origin: "http://localhost" },
      }),
    );
    const caller = /keel-caller=([^;]+)/.exec(minted.headers.get("set-cookie") ?? "")?.[1] ?? "";
    expect(caller).not.toBe("");
    bindStd(ctx, {
      "@keel/std-sessions": { sessions: { readers: [createHash("sha256").update(caller).digest("base64url")] } },
    });
    const res = await app.fetch(
      new Request("http://localhost/sessions/list?since=x", {
        headers: { accept: "application/json", cookie: `keel-caller=${caller}` },
      }),
    );
    expect(res.status).toBe(422);
    const text = await res.text();
    expect(text).toContain("keel.fields");
    expect(text).toContain("query.since");
  });

  test("`service({ contract: sessions })` has methods `ingest` and `list`", () => {
    const client = service({ contract: sessions });
    expect(typeof client.ingest).toBe("function");
    expect(typeof client.list).toBe("function");
  });

  test("`ingest` of a valid `Session` answers `ok({})`", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const app = await createApp({
      topology: topology({ sessions: { modules: ["sessions"], adapter: "node" } }),
      routes,
      ctx,
      mode: "production",
    });
    ctx.net.route("*", (req) => app.fetch(req));
    const parsed = Session.parse({
      v: 1,
      id: "s1",
      seed: 1337,
      deterministic: true,
      at: 1000,
      route: { id: "cart.show", params: {}, search: {} },
      state: {},
      events: [],
      error: null,
      fingerprint: "f",
    });
    if (!parsed.ok) throw new Error("fixture session does not parse");
    const r = await service({ contract: sessions }).ingest({ body: parsed.value }, ctx);
    expect(r).toEqual({ ok: true, value: {} });
  });
});
