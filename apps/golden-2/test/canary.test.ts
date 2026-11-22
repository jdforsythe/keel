// @vitest-environment node
// k.privacy: `.pii` values "are redacted in session capture, server logs, error text and the evidence bundle"; marked
// and secret fields "belong in an action `input`, never in a route's `params` or `search`". std.sessions: "every
// `.pii()`-marked path ... is redacted", "`s.secret` fields always go", and "every password field" is masked.
// Canaries go into every personal-data and secret field golden-2 takes: the sign-up name, email and password, a wrong
// password, a minted API token and a forged one, and the user id the library gives. Each sink is asserted on its own,
// so a leak names its sink and the field. The database is the one place they may be: it is checked to hold them, so
// the run is known to have carried them. Built artifacts and the evidence bundle are `tooling/smoke/canary.mjs`'s.
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { createApp } from "@keel/server";
import { sql } from "@keel/std-postgres";
import { beforeAll, describe, expect, it } from "vitest";
import source from "../identity.server.ts";
import mount from "../identity.ts";
import { accountsDb } from "../modules/accounts/accountsDb.server.ts";
import topology from "../topology.ts";
import { type Seen, browser } from "./accountsApp.ts";
import { apiRoutes } from "./apiRoutes.ts";
import {
  CANARIES,
  CANARY_EMAIL,
  CANARY_FAKE_TOKEN,
  CANARY_NAME,
  CANARY_OTHER_NAME,
  CANARY_PASSWORD,
  CANARY_WRONG,
  leaked,
} from "./canaries.ts";
import { NOW, apiCtx } from "./simApi.ts";

const SIGNUP = mount.href("/sign-up/email", { locale: "en-US" });
const SIGNIN = mount.href("/sign-in/email", { locale: "en-US" });
const SIGNOUT = mount.href("/sign-out", { locale: "en-US" });

const Minted = s.object({ ok: s.literal(true), value: s.object({ token: s.string(), id: s.string() }) });
const Session = s.object({ user: s.object({ id: s.string() }) });
const Profile = s.object({ email: s.string() });

type Answer = Seen & { path: string; method: string };
type Run = {
  server: SimCtx;
  log: string[];
  answers: Answer[];
  /** Every URL the browser asked for and every `location` it was sent to. */
  urls: string[];
  /** The canaries made at run time: the minted token and the user id. */
  minted: Record<string, string>;
};

/**
 * The whole account flow over the real `api` deployable and the project's identity source, with `format` logs in
 * `mode`: refused and accepted sign-ups and sign-ins, form and JSON, `/api/me` by cookie and by token, a minted token,
 * a tampered and a forged bearer, and sign-out.
 */
async function flow(format: "compact" | "json", mode: "dev" | "production", seed: number): Promise<Run> {
  const server = apiCtx(seed);
  const log: string[] = [];
  const app = await createApp({
    topology,
    routes: apiRoutes,
    ctx: server,
    deployable: "api",
    identity: source,
    mode,
    log: { format, write: (line: string) => log.push(line) },
  });
  const b = browser(app);
  const answers: Answer[] = [];
  const urls: string[] = [];
  const seen = (method: string, path: string, a: Seen): Seen => {
    urls.push(path);
    if (a.location !== null) urls.push(a.location);
    answers.push({ ...a, method, path });
    return a;
  };
  const post = async (path: string, fields: Record<string, string>) => {
    const r = await b.post(path, fields);
    seen("POST", path, r.posted);
    if (r.page !== null && r.posted.location !== null) seen("GET", r.posted.location, r.page);
    return r;
  };
  const json = async (method: string, path: string, extra: Record<string, string> = {}, body?: unknown) =>
    seen(method, path, await b.json(method, path, extra, body));

  await json("POST", "/api/auth/sign-up/email", {}, { name: CANARY_NAME, email: CANARY_EMAIL, password: "short" });
  await post(SIGNUP, { name: CANARY_NAME, email: CANARY_EMAIL, password: "short" });
  await post(SIGNUP, { name: CANARY_NAME, email: CANARY_EMAIL, password: CANARY_PASSWORD });
  await post(SIGNUP, { name: CANARY_OTHER_NAME, email: CANARY_EMAIL, password: CANARY_WRONG });
  await post(SIGNIN, { email: CANARY_EMAIL, password: CANARY_WRONG });
  await json("POST", "/api/auth/sign-in/email", {}, { email: CANARY_EMAIL, password: CANARY_WRONG });
  await post(SIGNIN, { email: CANARY_EMAIL, password: CANARY_PASSWORD });
  const who = Session.parse(JSON.parse((await json("GET", "/api/auth/get-session")).text));
  await json("GET", "/api/me");
  const mintedAnswer = Minted.parse(JSON.parse((await json("POST", "/api/tokens", {}, {})).text));
  const token = mintedAnswer.ok ? mintedAnswer.value.value.token : "";
  const minted = { token, tokenSecret: token.split("_").at(-1) ?? "", userId: who.ok ? who.value.user.id : "" };
  const other = browser(app);
  const bearer = async (value: string) => {
    const path = "/api/me";
    urls.push(path);
    const a = await other.json("GET", path, { authorization: value });
    answers.push({ ...a, method: "GET", path });
  };
  await bearer(`Bearer ${token}`);
  await bearer(`Bearer ${token.slice(0, -1)}${token.at(-1) === "0" ? "1" : "0"}`);
  await bearer(`Bearer ${CANARY_FAKE_TOKEN}`);
  await bearer(`Bearer ${CANARY_EMAIL}`);
  await bearer(`Basic ${CANARY_PASSWORD}`);
  await post(SIGNOUT, {});
  await app.close();
  return { server, log, answers, urls, minted };
}

/** An answer that refuses: a 4xx or 5xx, or a page reached by a redirect that carries `error`. */
const refusals = (r: Run) => r.answers.filter((a) => a.status >= 400 || /[?&]error=/.test(a.path));

const CONFIGS = [
  { format: "compact", mode: "production", seed: 61 },
  { format: "json", mode: "production", seed: 62 },
  { format: "compact", mode: "dev", seed: 63 },
  { format: "json", mode: "dev", seed: 64 },
] as const;

for (const c of CONFIGS) {
  describe(`canaries through the account flow, ${c.format} log, ${c.mode} mode`, () => {
    let run: Run;
    let all: Record<string, string> = { ...CANARIES };
    beforeAll(async () => {
      run = await flow(c.format, c.mode, c.seed);
      all = { ...CANARIES, ...run.minted };
    });

    it("carried the canaries: the database holds the email, and the run minted a token for a user", async () => {
      expect(run.minted.token).not.toBe("");
      expect(run.minted.userId).not.toBe("");
      const rows = await accountsDb(run.server).query(sql(Profile)`select email from profiles`);
      expect(rows.ok ? rows.value.map((r) => r.email) : rows.error.code).toEqual([CANARY_EMAIL]);
      expect(run.log.length).toBeGreaterThan(0);
    });

    it("sink: the server log", () => {
      expect(leaked(run.log.join("\n"), all)).toEqual([]);
    });

    it("sink: error answers and error pages, bodies and redirects", () => {
      const seen = refusals(run);
      expect(seen.length).toBeGreaterThanOrEqual(6);
      for (const a of seen)
        expect({
          at: `${a.method} ${a.path} ${a.status}`,
          leaked: leaked(`${a.text}\n${a.location ?? ""}`, all),
        }).toEqual({
          at: `${a.method} ${a.path} ${a.status}`,
          leaked: [],
        });
    });

    it("sink: URLs asked for and redirected to", () => {
      for (const u of run.urls) expect({ url: u, leaked: leaked(u, all) }).toEqual({ url: u, leaked: [] });
    });

    it("sink: cookies the server set", () => {
      const cookies = run.answers.flatMap((a) => a.cookies).join("\n");
      expect(leaked(cookies, all)).toEqual([]);
    });
  });
}

describe("canaries through a server error: the accounts database is unreachable at sign-in", () => {
  for (const mode of ["dev", "production"] as const) {
    it(`sink: the 500 answer, its page and the log, ${mode} mode`, async () => {
      const server = createCtx({
        mode: "sim",
        seed: 66,
        schedule: { net: [], storage: [], offline: [], plans: { "accounts.db": [{ delay: 0, fault: "unavailable" }] } },
      });
      server.clock.advance(NOW);
      const log: string[] = [];
      const app = await createApp({
        topology,
        routes: apiRoutes,
        ctx: server,
        deployable: "api",
        identity: source,
        mode,
        log: { format: "json", write: (line: string) => log.push(line) },
      });
      const b = browser(app);
      await b.post(SIGNUP, { name: CANARY_NAME, email: CANARY_EMAIL, password: CANARY_PASSWORD });
      const failed = await b.post(SIGNIN, { email: CANARY_EMAIL, password: CANARY_PASSWORD });
      const json = await b.json(
        "POST",
        "/api/auth/sign-in/email",
        {},
        { email: CANARY_EMAIL, password: CANARY_PASSWORD },
      );
      await app.close();
      expect(failed.posted.status).toBe(500);
      expect(leaked(`${failed.posted.text}\n${failed.posted.location ?? ""}`, CANARIES)).toEqual([]);
      expect(leaked(json.status >= 400 ? json.text : "", CANARIES)).toEqual([]);
      expect(leaked(log.join("\n"), CANARIES)).toEqual([]);
    });
  }
});
