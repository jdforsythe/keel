import { resolve } from "node:path";
// std.sessions: `record` keeps every value but `redact` entries and `.pii()` values, and password inputs are always
// redacted; k.privacy: a control bound to a marked path reports its `input` values as `x` repeated. std.sessions
// Ingest and std.monitor Read: `sessions.list` and `sessions.tally` load behind guard `sessions.reader`, which admits a
// `user` in `readers`. A signed-in user of golden-2 opens the sign-in page, which names the account, types another
// email and a password into the sign-in form under one recorder; the recording is uploaded to the api's
// `sessions.ingest` and read back by the operator account in `readers`.
import type { SimCtx } from "@keel/ctx";
import { createApp, identity } from "@keel/server";
import { NoRows, sql } from "@keel/std-postgres";
import { record } from "@keel/std-sessions";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { accountsDb } from "../modules/accounts/accountsDb.server.ts";
import { routes } from "../modules/accounts/routes.ts";
import topology from "../topology.ts";
import { apiRoutes } from "./apiRoutes.ts";
import { apiCtx, asJson } from "./simApi.ts";

const USER = "user-ada-signed-in";
const SIGNED_EMAIL = "ada.signedin@example.com";
const TYPED_EMAIL = "bob.typed.canary@example.com";
const PASSWORD = "typed horse battery staple";
const READER = "golden-2-ops";
/** The build's std config, as the generated entry passes it (tests run in the app's folder): it holds the `readers` of `modules/accounts/module.ts`. */
const STD = resolve(".keel/std.json");

/** The api over `server` with a switchable identity: each request is made by `who.id` (`''` for no one). */
async function api(server: SimCtx) {
  const who = { id: USER };
  const app = await createApp({
    topology,
    routes: apiRoutes,
    ctx: server,
    deployable: "api",
    identity: identity({ identify: async () => who.id }),
    std: STD,
  });
  return { app, who };
}

/** The user, signed in, on the sign-in page under one recorder: the recording, the page's text and the api. */
async function recorded() {
  const server = apiCtx(52);
  const { app, who } = await api(server);
  const saved = await accountsDb(server).run(
    sql(NoRows)`insert into profiles (user_id, email) values (${USER}, ${SIGNED_EMAIL})`,
  );
  // One ctx for the api and the page, as the `node` deployable serving `accounts.signin` has.
  const rec = record(server);
  const page = await renderRoute("accounts.signin", {
    routes,
    params: { locale: "en-US" },
    ctx: server,
    user: USER,
    app,
  });
  const named = page.find("accounts.signedIn").text;
  await page.fire("accounts.signinForm:email", { type: "input", value: TYPED_EMAIL });
  await page.fire("accounts.signinForm:password", { type: "input", value: PASSWORD });
  page.dispose();
  return { session: rec.stop(), named, saved: saved.ok, app, who };
}

/** The value each recorded `input` fire on `id` carried. */
function inputs(session: { events: readonly unknown[] }, id: string): string[] {
  const out: string[] = [];
  for (const e of session.events) {
    if (Reflect.get(Object(e), "kind") !== "fire" || Reflect.get(Object(e), "id") !== id) continue;
    const event: unknown = Reflect.get(Object(e), "event");
    if (Reflect.get(Object(event), "type") === "input") out.push(String(Reflect.get(Object(event), "value")));
  }
  return out;
}

describe("a session recorded for a signed-in user", () => {
  it("records the signed-in page: the account is named and the typed input is in the recording", async () => {
    const { session, named, saved } = await recorded();
    expect(saved).toBe(true);
    expect(named).toContain(SIGNED_EMAIL);
    expect(session.route.id).toBe("accounts.signin");
    expect(inputs(session, "accounts.signinForm:email")).toHaveLength(1);
  });

  it("redacts per the pii classes: the contact field's input is x repeated; no email, password or user id is kept", async () => {
    const { session } = await recorded();
    expect(inputs(session, "accounts.signinForm:email")).toEqual(["x".repeat(TYPED_EMAIL.length)]);
    const text = JSON.stringify(session);
    for (const value of [SIGNED_EMAIL, TYPED_EMAIL, PASSWORD, USER]) {
      expect({ value, kept: text.includes(value) }).toEqual({ value, kept: false });
    }
  });

  it("serves the uploaded recording and the tally to the reader only", async () => {
    const { session, app, who } = await recorded();
    const put = await app.fetch(asJson("POST", "/sessions", session));
    expect(put.status).toBe(200);
    const read = async (path: string) => {
      const res = await app.fetch(asJson("GET", path));
      return { status: res.status, text: await res.text() };
    };
    for (const id of ["", USER]) {
      who.id = id;
      expect({ id, status: (await read("/sessions/tally")).status }).toEqual({ id, status: 403 });
      expect({ id, status: (await read("/sessions/list")).status }).toEqual({ id, status: 403 });
    }
    who.id = READER;
    const tally = await read("/sessions/tally");
    expect(tally.status).toBe(200);
    expect(JSON.parse(tally.text)).toMatchObject({ results: { "sessions.tally": { ok: true, value: { v: 1 } } } });
    const list = await read("/sessions/list");
    expect(list.status).toBe(200);
    expect(list.text).toContain(session.fingerprint);
    for (const value of [SIGNED_EMAIL, TYPED_EMAIL, PASSWORD]) {
      expect({ value, kept: list.text.includes(value) }).toEqual({ value, kept: false });
    }
  });
});
