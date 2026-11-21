// @vitest-environment node
import { describe, expect, it } from "vitest";
import mount from "../identity.ts";
import { AccountData } from "../modules/accounts/AccountData.schema.ts";
import { BearerToken } from "../modules/accounts/BearerToken.schema.ts";
import { ErrorReply } from "../modules/accounts/ErrorReply.schema.ts";
import { Me } from "../modules/accounts/Me.schema.ts";
import { MintedToken } from "../modules/accounts/MintedToken.schema.ts";
import { TokenRequest } from "../modules/accounts/TokenRequest.schema.ts";
import { accounts } from "../modules/accounts/accounts.contract.ts";
import { accountsApi } from "../modules/accounts/accountsApi.ts";
import { authOf } from "../modules/accounts/authOf.server.ts";
import { bearerUser } from "../modules/accounts/bearerUser.server.ts";
import { loadMe } from "../modules/accounts/loadMe.server.ts";
import { loadSignin } from "../modules/accounts/loadSignin.server.ts";
import { loadSignup } from "../modules/accounts/loadSignup.server.ts";
import { postToken } from "../modules/accounts/postToken.server.ts";
import { EMAIL, NAME, PASSWORD, accountsApp, browser } from "./accountsApp.ts";
import { apiCtx } from "./simApi.ts";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/** The JSON body of an answer, parsed with `schema`, or null. */
const body = <T>(text: string, schema: { parse(x: unknown): { ok: true; value: T } | { ok: false } }) => {
  const parsed = schema.parse(JSON.parse(text));
  return parsed.ok ? parsed.value : null;
};

/** A browser that signed up and signed in through the pages. */
async function signedIn(seed: number) {
  const server = apiCtx(seed);
  const { app, lines } = await accountsApp(server);
  const b = browser(app);
  await b.post(mount.href("/sign-up/email"), { name: NAME, email: EMAIL, password: PASSWORD });
  await b.post(mount.href("/sign-in/email"), { email: EMAIL, password: PASSWORD });
  return { server, app, lines, b };
}

/** The `accounts.me` entry of a GET answer (`{ id, results }`). */
const entry = (text: string): unknown =>
  Reflect.get(Object(Reflect.get(Object(JSON.parse(text)), "results")), "accounts.me");
const meOf = (text: string) => {
  const parsed = Me.parse(Reflect.get(Object(entry(text)), "value"));
  return parsed.ok ? parsed.value : null;
};
const deniedOf = (text: string) => {
  const parsed = ErrorReply.parse(Reflect.get(Object(entry(text)), "error"));
  return parsed.ok ? parsed.value : null;
};

const Minted = { parse: (x: unknown) => MintedToken.parse(Reflect.get(Object(x), "value")) };

describe("API tokens", () => {
  it("mints a token for the signed-in user that /api/me accepts, by itself, until it expires", async () => {
    const { server, app, lines, b } = await signedIn(21);
    expect(meOf((await b.json("GET", "/api/me")).text)).toEqual({ email: EMAIL });

    const res = await b.json("POST", "/api/tokens", {}, {});
    expect(res.status).toBe(200);
    const minted = body(res.text, Minted);
    expect(minted).not.toBeNull();
    if (minted === null) return;
    const { token, id, expiresAt } = minted;
    expect(token.startsWith(`keelsim_${id}_`)).toBe(true);
    expect(expiresAt).toBe(server.clock.now() + THIRTY_DAYS);

    const bearer = browser(app);
    const me = await bearer.json("GET", "/api/me", { authorization: `Bearer ${token}` });
    expect(me.status).toBe(200);
    expect(meOf(me.text)).toEqual({ email: EMAIL });

    const last = token.at(-1) === "0" ? "1" : "0";
    const tampered = await bearer.json("GET", "/api/me", { authorization: `Bearer ${token.slice(0, -1)}${last}` });
    expect(tampered.status).toBe(403);
    expect(deniedOf(tampered.text)?.code).toBe("keel.denied");
    expect((await bearer.json("GET", "/api/me", { authorization: `Basic ${token}` })).status).toBe(403);

    server.clock.advance(THIRTY_DAYS - 1);
    expect((await bearer.json("GET", "/api/me", { authorization: `Bearer ${token}` })).status).toBe(200);
    server.clock.advance(2);
    expect((await bearer.json("GET", "/api/me", { authorization: `Bearer ${token}` })).status).toBe(403);

    const stored = (await server.storage.get("keel.store.accounts.tokens")) ?? "";
    expect(stored).toContain(id);
    expect(stored).toContain("$sha256-sim$");
    expect(stored).not.toContain(token);
    expect(stored).not.toContain(EMAIL);

    const log = lines.join("\n");
    for (const canary of [EMAIL, PASSWORD, token]) expect(log).not.toContain(canary);
  });

  it("refuses /api/me with neither a session nor a token, and minting when signed out or by a token", async () => {
    const { app, b } = await signedIn(22);
    const stranger = browser(app);
    const none = await stranger.json("GET", "/api/me");
    expect(none.status).toBe(403);
    expect(deniedOf(none.text)).toMatchObject({ code: "keel.denied", message: "Sign in first" });
    const refused = await stranger.json("POST", "/api/tokens", {}, {});
    expect(refused.status).toBe(403);
    expect(ErrorReply.parse(Reflect.get(Object(JSON.parse(refused.text)), "error"))).toMatchObject({
      ok: true,
      value: { code: "keel.denied" },
    });

    const minted = body((await b.json("POST", "/api/tokens", {}, {})).text, Minted);
    const byToken = await stranger.json("POST", "/api/tokens", { authorization: `Bearer ${minted?.token ?? ""}` }, {});
    expect(byToken.status).toBe(403);
  });

  it("the services client reaches /api/me with a bearer token and is refused without one", async () => {
    const { app, b } = await signedIn(23);
    const minted = body((await b.json("POST", "/api/tokens", {}, {})).text, Minted);
    const ctx = apiCtx(5);
    ctx.net.route("http://accounts.keel.invalid/api/*", (req) => app.fetch(req));
    const none = await accountsApi.me({}, ctx);
    expect(none.ok ? null : none.error).toMatchObject({ code: "api.status", data: { status: 403 } });
    const bearer = BearerToken.parse(minted?.token);
    expect(bearer.ok).toBe(true);
    if (!bearer.ok) return;
    expect(await accountsApi.me({ bearer: bearer.value }, ctx)).toEqual({ ok: true, value: { email: EMAIL } });
  });
});

describe("the user a bearer header acts for", () => {
  it("bearerUser gives the minting user for a live token and '' otherwise, saving nothing", async () => {
    const { server, b } = await signedIn(24);
    const minted = body((await b.json("POST", "/api/tokens", {}, {})).text, Minted);
    expect(minted).not.toBeNull();
    if (minted === null) return;
    const { token } = minted;
    const before = await server.storage.get("keel.store.accounts.tokens");
    const profiles = (await server.storage.get("keel.store.accounts.profiles")) ?? "";

    const userId = await bearerUser(`Bearer ${token}`, server);
    expect(userId).not.toBe("");
    expect(profiles).toContain(JSON.stringify(userId));
    expect(await bearerUser(`bearer ${token}`, server)).toBe(userId);

    const last = token.at(-1) === "0" ? "1" : "0";
    for (const header of [
      "",
      "Bearer ",
      token,
      `Basic ${token}`,
      `Bearer ${token} extra`,
      `Bearer ${token.slice(0, -1)}${last}`,
      `Bearer keelsim_unknown_${"0".repeat(32)}`,
    ])
      expect(await bearerUser(header, server)).toBe("");
    expect(await bearerUser(`Bearer ${token}`, apiCtx(25))).toBe("");

    server.clock.advance(THIRTY_DAYS - 1);
    expect(await bearerUser(`Bearer ${token}`, server)).toBe(userId);
    server.clock.advance(2);
    expect(await bearerUser(`Bearer ${token}`, server)).toBe("");
    expect(await server.storage.get("keel.store.accounts.tokens")).toBe(before);
  });
});

describe("the sign-in library behind the identity seam", () => {
  it("authOf opens one library per ctx storage, at the identity mount, each with users of its own", async () => {
    const one = apiCtx(26);
    const other = apiCtx(27);
    const opened = authOf(one);
    expect(authOf(one)).toBe(opened);
    const auth = await opened;
    const apart = await authOf(other);
    expect(auth.ok).toBe(true);
    expect(apart.ok).toBe(true);
    if (!auth.ok || !apart.ok) return;
    expect(apart.value).not.toBe(auth.value);
    expect(auth.value.options.basePath).toBe(mount.path);

    const first = browser((await accountsApp(one)).app);
    const second = browser((await accountsApp(other)).app);
    await first.post(mount.href("/sign-up/email"), { name: NAME, email: EMAIL, password: PASSWORD });
    const known = await first.post(mount.href("/sign-in/email"), { email: EMAIL, password: PASSWORD });
    const unknown = await second.post(mount.href("/sign-in/email"), { email: EMAIL, password: PASSWORD });
    expect(known.posted.location).toBe(accounts.href("accounts.signin", { locale: "en-US" }));
    expect(unknown.posted.location).toBe(
      accounts.href("accounts.signin", { locale: "en-US" }, { error: "credentials" }),
    );
    expect(meOf((await first.json("GET", "/api/me")).text)).toEqual({ email: EMAIL });
    expect((await second.json("GET", "/api/me")).status).toBe(403);
  });
});

describe("accounts wiring", () => {
  it("serves the pages with loadSignin and loadSignup and /api/me with loadMe", () => {
    expect(loadSignin.output).toBe(AccountData);
    expect(loadSignup.output).toBe(AccountData);
    expect(loadMe.output).toBe(Me);
  });

  it("gives the API action an output and no page an action: the pages post to the identity mount", () => {
    expect(postToken.input).toBe(TokenRequest);
    expect(postToken.output).toBe(MintedToken);
    expect(accounts.href("accounts.signin", { locale: "en-US" })).toBe("/account/signin");
    expect(mount.path).toBe("/api/auth");
  });

  it("the accounts contract names the two API routes' paths and answers", () => {
    expect([
      accounts.entries["accounts.mint"].method,
      accounts.entries["accounts.mint"].path,
      accounts.entries["accounts.mint"].output,
    ]).toEqual(["POST", "/api/tokens", MintedToken]);
    expect([
      accounts.entries["accounts.me"].method,
      accounts.entries["accounts.me"].path,
      accounts.entries["accounts.me"].output,
    ]).toEqual(["GET", "/api/me", Me]);
  });
});
