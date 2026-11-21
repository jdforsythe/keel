// @vitest-environment node
// `sessions.tally` is an entry of the one `sessions` contract and its `./routes` (std.monitor Read): an app that
// places module `sessions` beside its own joins one table without E1502, with or without the `monitor` runner, and
// the tally answers readers either way. Seed 1337
import { createHash } from "node:crypto";
import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import { manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { createApp, topology } from "@keel/server";
import { expect, test } from "vitest";
import { Session } from "../src/Session.schema.ts";
import { fingerprint } from "../src/internal/fingerprint.ts";
import { Tally } from "../src/monitor/Tally.schema.ts";
import { monitor } from "../src/monitor/monitor.ts";
import { routes } from "../src/routes.ts";
import { sessions } from "../src/sessions.contract.ts";

const BASE = "http://localhost";
const json = { accept: "application/json", "content-type": "application/json" };
const shop = contract("shop", { "shop.home": { path: "/" } });
const shopRoutes = manifest(shop, { "shop.home": { component: () => document.createTextNode("home") } });
const calm = (): Session => {
  const r = Session.parse({
    v: 1,
    id: "s-1",
    deterministic: false,
    at: 0,
    route: { id: "shop.home", params: {}, search: {} },
    state: {},
    events: [],
    error: null,
    fingerprint: fingerprint(null, "shop.home"),
  });
  if (!r.ok) throw new Error("session");
  return r.value;
};

async function placed(monitoring: boolean) {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const table = routeTable(shopRoutes, routes);
  const app = await createApp({
    topology: topology({ web: { modules: ["shop", "sessions"], adapter: "node" } }),
    routes: table,
    ctx,
    mode: "production",
  });
  if (monitoring) {
    const stop = new AbortController();
    ctx.clock.advance(5);
    const ran = monitor.run(ctx, stop.signal);
    stop.abort();
    await ran;
  }
  const minted = await app.fetch(
    new Request(`${BASE}/sessions`, { method: "POST", headers: json, body: JSON.stringify(calm()) }),
  );
  const value = /keel-caller=([^;]+)/.exec(minted.headers.get("set-cookie") ?? "")?.[1] ?? "";
  const tally = (cookie: string) =>
    app.fetch(new Request(`${BASE}/sessions/tally`, { headers: { accept: "application/json", cookie } }));
  const denied = await tally("");
  bindStd(ctx, {
    "@keel/std-sessions": { ops: { readers: [createHash("sha256").update(value).digest("base64url")] } },
  });
  const res = await tally(`keel-caller=${value}`);
  const body: unknown = await res.json();
  const result: unknown = Reflect.get(Object(Reflect.get(Object(body), "results")), "sessions.tally");
  return { table, denied: denied.status, status: res.status, tally: Tally.parse(Reflect.get(Object(result), "value")) };
}

test("one sessions contract holds ingest, list and tally, and one routes table binds them", () => {
  expect(Object.keys(sessions.entries)).toEqual(["sessions.ingest", "sessions.list", "sessions.tally"]);
  expect(routes.contracts).toEqual([sessions]);
});

test("placed without the monitor runner: the table joins without E1502 and the tally is the empty one", async () => {
  const got = await placed(false);
  expect(got.table.contracts).toEqual([shop, sessions]);
  expect(got.denied).toBe(403);
  expect(got.status).toBe(200);
  expect(got.tally).toEqual({ ok: true, value: { v: 1, from: 0, to: 0, tx: {} } });
});

test("placed with the monitor runner: the same table, and the tally is the one it merged", async () => {
  const got = await placed(true);
  expect(got.table.contracts).toEqual([shop, sessions]);
  expect(got.denied).toBe(403);
  expect(got.tally).toEqual({ ok: true, value: { v: 1, from: 5, to: 5, tx: {} } });
});
