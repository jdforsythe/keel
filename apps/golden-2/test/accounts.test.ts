import { createCtx } from "@keel/ctx";
import { NoRows, sql } from "@keel/std-postgres";
import { tokens } from "@keel/std-tokens/server";
import { render, renderRoute, resumeDocument } from "@keel/testing";
import { describe, expect, it } from "vitest";
import mount from "../identity.ts";
import { AccountData } from "../modules/accounts/AccountData.schema.ts";
import { AccountError } from "../modules/accounts/AccountError.schema.ts";
import { AccountsLocale } from "../modules/accounts/AccountsLocale.schema.ts";
import { AccountsParams } from "../modules/accounts/AccountsParams.schema.ts";
import { AccountsSearch } from "../modules/accounts/AccountsSearch.schema.ts";
import { AccountsText } from "../modules/accounts/AccountsText.schema.ts";
import deText from "../modules/accounts/AccountsText/de-DE.ts";
import enText from "../modules/accounts/AccountsText/en-US.ts";
import jaText from "../modules/accounts/AccountsText/ja-JP.ts";
import { ApiToken } from "../modules/accounts/ApiToken.schema.ts";
import { BearerToken } from "../modules/accounts/BearerToken.schema.ts";
import { Credentials } from "../modules/accounts/Credentials.schema.ts";
import { Me } from "../modules/accounts/Me.schema.ts";
import { Registration } from "../modules/accounts/Registration.schema.ts";
import { SignedInUser } from "../modules/accounts/SignedInUser.schema.ts";
import SigninPage from "../modules/accounts/SigninPage.tsx";
import SignupPage from "../modules/accounts/SignupPage.tsx";
import { accountsDb } from "../modules/accounts/accountsDb.server.ts";
import { authSettings } from "../modules/accounts/authSettings.server.ts";
import { routes } from "../modules/accounts/routes.ts";
import { EMAIL, NAME, PASSWORD, accountsApp } from "./accountsApp.ts";
import { apiCtx } from "./simApi.ts";

describe("accounts database", () => {
  it("keeps one profile per user, the latest email", async () => {
    const ctx = apiCtx(11);
    const db = accountsDb(ctx);
    const upsert = (email: string) =>
      db.run(sql(NoRows)`insert into profiles (user_id, email) values (${"u1"}, ${email})
                         on conflict (user_id) do update set email = excluded.email`);
    expect(await upsert(EMAIL)).toEqual({ ok: true, value: 1 });
    expect(await upsert("ada.second@example.com")).toEqual({ ok: true, value: 1 });
    expect(await db.query(sql(Me)`select email from profiles`)).toEqual({
      ok: true,
      value: [{ email: "ada.second@example.com" }],
    });
  });
  it("refuses a second token row with one id", async () => {
    const ctx = apiCtx(12);
    const minted = tokens(ctx).mint({ ttl: 60_000 });
    if (!minted.ok) throw new Error("sim mint refused");
    const { id, digest } = minted.value;
    const insert = () =>
      accountsDb(ctx).run(sql(NoRows)`insert into api_tokens (id, digest, user_id) values (${id}, ${digest}, ${"u1"})`);
    expect(await insert()).toEqual({ ok: true, value: 1 });
    const again = await insert();
    expect(again.ok ? null : again.error.code).toBe("postgres.constraint");
  });
});

describe("accounts schemas", () => {
  it("Credentials and Registration take the library's password lengths and hold the password as a secret", () => {
    const good = Credentials.parse({ email: EMAIL, password: PASSWORD });
    expect(good.ok).toBe(true);
    expect(JSON.stringify(good.ok ? good.value : null)).not.toContain(PASSWORD);
    expect(Credentials.parse({ email: EMAIL, password: "short" }).ok).toBe(false);
    expect(Credentials.parse({ email: EMAIL, password: "x".repeat(129) }).ok).toBe(false);
    expect(Credentials.parse({ email: "", password: PASSWORD }).ok).toBe(false);
    expect(Registration.parse({ name: NAME, email: EMAIL, password: PASSWORD }).ok).toBe(true);
    expect(Registration.parse({ name: "", email: EMAIL, password: PASSWORD }).ok).toBe(false);
  });

  it("marks the email, the name and a token's user as personal data", () => {
    expect(Registration.doc()).toMatch(/name: .*pii\(name\)/);
    expect(Registration.doc()).toMatch(/email: .*pii\(contact\)/);
    expect(Credentials.doc()).toMatch(/email: .*pii\(contact\)/);
    expect(ApiToken.doc()).toMatch(/userId: .*pii\(identifier\)/);
    expect(Me.doc()).toMatch(/email: .*pii\(contact\)/);
    expect(SignedInUser.doc()).toMatch(/email: .*pii\(contact\)/);
    expect(AccountData.doc()).toMatch(/email\?: .*pii\(contact\)/);
  });

  it("ApiToken holds a digest and the library's user id, and refuse a token's text", () => {
    const ctx = createCtx({ mode: "sim", seed: 31 });
    const minted = tokens(ctx).mint({ ttl: 60_000 });
    if (!minted.ok) throw new Error("sim mint refused");
    const row = { id: minted.value.id, digest: minted.value.digest, userId: "9b8CJ0rjFLjoNDXn" };
    expect(ApiToken.parse(row).ok).toBe(true);
    expect(ApiToken.parse({ ...row, digest: "keel_0_0" }).ok).toBe(false);
    expect(ApiToken.parse({ ...row, userId: "" }).ok).toBe(false);
    expect(ApiToken.parse({ ...row, id: "" }).ok).toBe(false);
  });

  it("the page schemas: locale, params, search, refusal, data and a bearer token", async () => {
    expect(AccountsLocale.parse("ja-JP").ok).toBe(true);
    expect(AccountsLocale.parse("fr-FR").ok).toBe(false);
    expect(AccountsParams.parse({ locale: "de-DE" }).ok).toBe(true);
    expect(AccountsSearch.parse({}).ok).toBe(true);
    expect(AccountsSearch.parse({ error: "credentials" }).ok).toBe(true);
    expect(AccountsSearch.parse({ error: EMAIL }).ok).toBe(false);
    expect(AccountError.parse("invalid").ok).toBe(true);
    const text = await AccountsText.load("en-US");
    expect(AccountData.parse({ text }).ok).toBe(true);
    expect(AccountData.parse({ text, email: EMAIL }).ok).toBe(true);
    expect(BearerToken.parse("keelsim_a_b").ok).toBe(true);
    expect(BearerToken.parse("").ok).toBe(false);
  });

  it("SignedInUser reads a user id and an email, and refuses a missing one", () => {
    expect(SignedInUser.parse({ redirect: false, user: { id: "u", email: EMAIL, name: NAME } }).ok).toBe(true);
    expect(SignedInUser.parse({ user: { id: "u" } }).ok).toBe(false);
  });

  it("the three locale files fill every key", async () => {
    for (const entry of [enText, deText, jaText]) expect(AccountsText.parse(entry).ok).toBe(true);
    expect((await AccountsText.load("de-DE")).signinHeading).toBe(deText.signinHeading);
  });
});

describe("authSettings", () => {
  const argv = ["--experimental-webstorage", "--localstorage-file=/data/storage"];
  it("uses a fixed secret and an in-memory database for the explicit test entry, and stays quiet", () => {
    expect(authSettings({ AUTH_FIXTURE: "test", BETTER_AUTH_SECRET: "ignored" }, argv)).toMatchObject({
      ok: true,
      value: { database: ":memory:", quiet: true },
    });
  });
  it("refuses to run without BETTER_AUTH_SECRET outside the explicit test and dev entries, whatever NODE_ENV says", () => {
    const short = "too-short-secret";
    const envs = [
      {},
      { NODE_ENV: "production" },
      { NODE_ENV: "test" },
      { NODE_ENV: "development" },
      { AUTH_FIXTURE: "prod" },
      { BETTER_AUTH_SECRET: short },
    ];
    for (const env of envs) {
      const r = authSettings(env, argv);
      expect(r.ok).toBe(false);
      expect(r.ok ? "" : r.error.message).toContain("BETTER_AUTH_SECRET");
      expect(r.ok ? "" : r.error.message).not.toContain(short);
    }
  });
  it("keeps the database beside the web storage file, or at AUTH_DATABASE_PATH", () => {
    const secret = "s".repeat(32);
    expect(authSettings({ BETTER_AUTH_SECRET: secret }, argv)).toMatchObject({
      ok: true,
      value: { secret, database: "/data/auth.sqlite", quiet: false },
    });
    expect(authSettings({ BETTER_AUTH_SECRET: secret, AUTH_DATABASE_PATH: "/x/a.db" }, argv)).toMatchObject({
      value: { database: "/x/a.db" },
    });
    expect(authSettings({ BETTER_AUTH_SECRET: secret, KEEL_ORIGIN: "https://box.example" }, [])).toMatchObject({
      value: { database: "auth.sqlite", origin: "https://box.example" },
    });
    expect(authSettings({ AUTH_FIXTURE: "dev" }, [])).toMatchObject({ ok: true, value: { quiet: false } });
  });
});

describe("account pages", () => {
  it("SignupPage labels its name, email and password fields in each locale", async () => {
    const pages: { locale: AccountsLocale; entry: AccountsText }[] = [
      { locale: "en-US", entry: enText },
      { locale: "de-DE", entry: deText },
      { locale: "ja-JP", entry: jaText },
    ];
    for (const { locale, entry } of pages) {
      const t = render(SignupPage, { props: { params: { locale }, search: {}, data: { text: entry } } });
      expect(t.find("accounts.signup.heading").text).toBe(entry.signupHeading);
      expect(t.find("accounts.signupForm:name").name).toBe(entry.nameLabel);
      expect(t.find("accounts.signupForm:email").name).toBe(entry.emailLabel);
      expect(t.find("accounts.signupForm:password").name).toBe(entry.passwordLabel);
      expect(t.find("accounts.signupSubmit").name).toBe(entry.signupSubmit);
      t.dispose();
    }
    const refused = render(SignupPage, {
      props: { params: { locale: "en-US" }, search: { error: "invalid" }, data: { text: enText } },
    });
    expect(refused.find("accounts.signupError").text).toBe(enText.errorInvalid);
    refused.dispose();
  });

  it("SigninPage shows the form signed out, the refusal when there is one, and the account and sign-out signed in", () => {
    const out = render(SigninPage, { props: { params: { locale: "en-US" }, search: {}, data: { text: enText } } });
    expect(out.find("accounts.signinForm:email").name).toBe("Email");
    expect(out.find("accounts.signinForm:password").name).toBe("Password");
    expect(out.find("accounts.signinSubmit").name).toBe("Sign in");
    expect(JSON.stringify(out.a11y())).not.toContain("Signed in as");
    out.dispose();
    const wrong = render(SigninPage, {
      props: { params: { locale: "de-DE" }, search: { error: "credentials" }, data: { text: deText } },
    });
    expect(wrong.find("accounts.signinError").text).toBe(deText.errorCredentials);
    wrong.dispose();
    const signed = render(SigninPage, {
      props: { params: { locale: "en-US" }, search: {}, data: { text: enText, email: EMAIL } },
    });
    expect(signed.find("accounts.signedIn").text).toBe(`Signed in as ${EMAIL}`);
    expect(signed.find("accounts.signOut").name).toBe("Sign out");
    signed.dispose();
  });

  it("the pages pass the accessibility checks as routes, and tab through their fields in order", async () => {
    const up = await renderRoute("accounts.signup", { routes, params: { locale: "ja-JP" } });
    expect(up.focusOrder()).toEqual([
      "accounts.signupForm:name",
      "accounts.signupForm:email",
      "accounts.signupForm:password",
      "accounts.signupSubmit",
      "accounts.toSignin",
    ]);
    up.dispose();
    const signin = await renderRoute("accounts.signin", {
      routes,
      params: { locale: "en-US" },
      search: { error: "credentials" },
    });
    expect(signin.find("accounts.signinError").text).toBe(enText.errorCredentials);
    signin.dispose();
  });

  it("validates on the client and the browser posts only the named fields, to the mount, never into a URL", async () => {
    const page = await renderRoute("accounts.signin", { routes, params: { locale: "de-DE" } });
    await page.fire("accounts.signinForm:email", { type: "input", value: EMAIL });
    await page.fire("accounts.signinForm:password", { type: "input", value: "short" });
    await page.fire("accounts.signinSubmit", { type: "click" });
    expect(page.documents()).toEqual([]);
    expect(page.find("accounts.signinForm:password:error").text).not.toBe("");
    await page.fire("accounts.signinForm:password", { type: "input", value: PASSWORD });
    await page.fire("accounts.signinSubmit", { type: "click" });
    expect(page.documents()).toEqual([
      {
        method: "POST",
        url: mount.href("/sign-in/email", { locale: "de-DE" }),
        body: new URLSearchParams({ email: EMAIL, password: PASSWORD }).toString(),
      },
    ]);
    page.dispose();
  });
});

describe("placement", () => {
  /** The sign-up page's documents for the same typing, in a client router and on the page `createApp` served. */
  async function typed(h: {
    fire(id: string, e: { type: string; value?: string }): Promise<unknown>;
    documents(): readonly unknown[];
  }) {
    await h.fire("accounts.signupForm:name", { type: "input", value: NAME });
    await h.fire("accounts.signupForm:email", { type: "input", value: "x" });
    await h.fire("accounts.signupForm:password", { type: "input", value: PASSWORD });
    await h.fire("accounts.signupSubmit", { type: "click" });
    const invalid = [...h.documents()];
    await h.fire("accounts.signupForm:email", { type: "input", value: EMAIL });
    await h.fire("accounts.signupSubmit", { type: "click" });
    return { invalid, valid: [...h.documents()] };
  }

  it("the sign-up page posts the same document from a client router and from the node deployable's served page", async () => {
    const client = await renderRoute("accounts.signup", { routes, params: { locale: "en-US" } });
    const inClient = await typed(client);
    client.dispose();
    const { app } = await accountsApp(apiCtx(51));
    const res = await app.fetch(new Request("http://localhost/account/signup", { headers: { accept: "text/html" } }));
    expect(res.status).toBe(200);
    const served = await resumeDocument(await res.text(), { routes });
    const onNode = await typed(served);
    served.dispose();
    expect(inClient.invalid).toEqual([]);
    expect(onNode).toEqual(inClient);
    expect(inClient.valid).toEqual([
      {
        method: "POST",
        url: mount.href("/sign-up/email", { locale: "en-US" }),
        body: new URLSearchParams({ name: NAME, email: EMAIL, password: PASSWORD }).toString(),
      },
    ]);
  });
});
