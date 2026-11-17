import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { credentials } from "@keel/std-credentials/server";
import { isolate } from "@keel/store";
import { properties, render, renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { ApiToken } from "../modules/accounts/ApiToken.schema.ts";
import { ApiTokens } from "../modules/accounts/ApiTokens.schema.ts";
import { Credentials } from "../modules/accounts/Credentials.schema.ts";
import { ErrorReply } from "../modules/accounts/ErrorReply.schema.ts";
import { Me } from "../modules/accounts/Me.schema.ts";
import { MintedToken } from "../modules/accounts/MintedToken.schema.ts";
import { PasswordChange } from "../modules/accounts/PasswordChange.schema.ts";
import { Session } from "../modules/accounts/Session.schema.ts";
import { Sessions } from "../modules/accounts/Sessions.schema.ts";
import { SignedIn } from "../modules/accounts/SignedIn.schema.ts";
import SigninPage from "../modules/accounts/SigninPage.tsx";
import SignupPage from "../modules/accounts/SignupPage.tsx";
import { TokenRequest } from "../modules/accounts/TokenRequest.schema.ts";
import { User } from "../modules/accounts/User.schema.ts";
import { Users } from "../modules/accounts/Users.schema.ts";
import { accountStores } from "../modules/accounts/accountStores.ts";
import { addToken } from "../modules/accounts/addToken.ts";
import { addUser } from "../modules/accounts/addUser.ts";
import { routes } from "../modules/accounts/routes.ts";
import { setPassword } from "../modules/accounts/setPassword.ts";
import { signIn } from "../modules/accounts/signIn.ts";
import { wrongCredentials } from "../modules/accounts/wrongCredentials.ts";

const scopes: { dispose(): void }[] = [];
afterEach(() => {
  for (const sc of scopes.splice(0)) sc.dispose();
});

/** Stores for one request, in a fresh isolated scope (k.testing: factory stores need a scope). */
const fresh = () => {
  const sc = scope(() => undefined);
  isolate(sc);
  scopes.push(sc);
  return sc.run(accountStores);
};

describe("accounts transactions", () => {
  it("addUser keeps ids and emails unique", async () => {
    const { addUser } = fresh();
    await properties(addUser);
  });
  it("setPassword keeps the users invariant", async () => {
    const { setPassword } = fresh();
    await properties(setPassword);
  });
  it("signIn keeps one session per caller", async () => {
    const { signIn } = fresh();
    await properties(signIn);
  });
  it("addToken keeps token ids unique", async () => {
    const { addToken } = fresh();
    await properties(addToken);
  });
});

const EMAIL = "ada@example.com";
const PASSWORD = "correct horse battery";

/** The saved `accounts.users` state (k.server: `ctx.storage` key `keel.store.<id>`). */
const Saved = s.object({ state: Users });

type Ctx = ReturnType<typeof createCtx>;

async function savedUsers(ctx: Ctx): Promise<Users> {
  const raw = await ctx.storage.get("keel.store.accounts.users");
  const parsed = Saved.parse(raw === null ? null : JSON.parse(raw));
  return parsed.ok ? parsed.value.state : { users: [] };
}

/** Fill a credentials form and submit it. */
async function submit(
  page: Awaited<ReturnType<typeof renderRoute>>,
  form: string,
  email: string,
  password: string,
  button: string,
) {
  await page.fire(`${form}:email`, { type: "input", value: email });
  await page.fire(`${form}:password`, { type: "input", value: password });
  await page.fire(button, { type: "click" });
}

async function signUp(ctx: Ctx) {
  const page = await renderRoute("accounts.signup", { routes, ctx, caller: "c1" });
  await submit(page, "accounts.signupForm", EMAIL, PASSWORD, "accounts.signupSubmit");
  return page;
}

describe("accounts pages", () => {
  it("signs up, goes to sign-in, signs in and names the account", async () => {
    const ctx = createCtx({ mode: "sim", seed: 11 });
    const page = await signUp(ctx);
    expect(page.route().id).toBe("accounts.signin");
    page.dispose();
    const signin = await renderRoute("accounts.signin", { routes, ctx, caller: "c1" });
    await submit(signin, "accounts.signinForm", EMAIL, PASSWORD, "accounts.signinSubmit");
    expect(signin.find("accounts.signedIn").text).toBe(`Signed in as ${EMAIL}`);
    signin.dispose();
  });

  it("stores a hash, never the password text", async () => {
    const ctx = createCtx({ mode: "sim", seed: 12 });
    (await signUp(ctx)).dispose();
    const saved = await savedUsers(ctx);
    expect(saved.users.map((u) => u.email)).toEqual([EMAIL]);
    const stored = String(saved.users[0]?.password);
    expect(stored.startsWith("$scrypt-sim$")).toBe(true);
    expect(await ctx.storage.get("keel.store.accounts.users")).not.toContain(PASSWORD);
  });

  it("answers a wrong password and an unknown email alike, and signs in neither", async () => {
    const ctx = createCtx({ mode: "sim", seed: 13 });
    (await signUp(ctx)).dispose();
    const wrong = await renderRoute("accounts.signin", { routes, ctx, caller: "c2" });
    await submit(wrong, "accounts.signinForm", EMAIL, "not the password", "accounts.signinSubmit");
    const wrongText = wrong.find("accounts.signinError").text;
    wrong.dispose();
    const unknown = await renderRoute("accounts.signin", { routes, ctx, caller: "c3" });
    await submit(unknown, "accounts.signinForm", "bob@example.com", PASSWORD, "accounts.signinSubmit");
    const unknownText = unknown.find("accounts.signinError").text;
    unknown.dispose();
    expect(wrongText).toBe(wrongCredentials.message);
    expect(unknownText).toBe(wrongText);
    const sessions = await ctx.storage.get("keel.store.accounts.sessions");
    expect(sessions === null || !sessions.includes('"caller":"c2"')).toBe(true);
  });

  it("refuses a second sign-up with the same email as a field error", async () => {
    const ctx = createCtx({ mode: "sim", seed: 14 });
    (await signUp(ctx)).dispose();
    const again = await signUp(ctx);
    expect(again.route().id).toBe("accounts.signup");
    expect(again.find("accounts.signupForm:email:error").text).toBe("Already signed up");
    again.dispose();
  });
});

/** A sim password hash and token digest, as `credentials(ctx)` makes them under sim. */
async function minted() {
  const ctx = createCtx({ mode: "sim", seed: 31 });
  const secret = Credentials.parse({ email: EMAIL, password: PASSWORD });
  if (!secret.ok) throw new Error("credentials do not parse");
  const hashed = await credentials(ctx).hash(secret.value.password);
  const token = credentials(ctx).mint({ ttl: 60_000 });
  if (!hashed.ok || !token.ok) throw new Error("sim credentials refused");
  const user = ctx.random.id("User");
  return { password: hashed.value, digest: token.value.digest, id: token.value.id, user };
}

describe("accounts schemas", () => {
  it("Credentials takes an email and a secret password of 8 or more characters", () => {
    const good = Credentials.parse({ email: EMAIL, password: PASSWORD });
    expect(good.ok).toBe(true);
    expect(JSON.stringify(good.ok ? good.value : null)).not.toContain(PASSWORD);
    expect(Credentials.parse({ email: EMAIL, password: "short" }).ok).toBe(false);
    expect(Credentials.parse({ email: "", password: PASSWORD }).ok).toBe(false);
  });

  it("User and Users hold a hash, and refuse plain password text", async () => {
    const m = await minted();
    const user = { id: m.user, email: EMAIL, password: m.password };
    expect(User.parse(user).ok).toBe(true);
    expect(Users.parse({ users: [user] }).ok).toBe(true);
    expect(User.parse({ ...user, password: PASSWORD }).ok).toBe(false);
    expect(Users.parse({ users: [{ ...user, email: "" }] }).ok).toBe(false);
  });

  it("PasswordChange takes an account id and a hash", async () => {
    const m = await minted();
    expect(PasswordChange.parse({ userId: m.user, password: m.password }).ok).toBe(true);
    expect(PasswordChange.parse({ userId: m.user, password: PASSWORD }).ok).toBe(false);
  });

  it("ApiToken and ApiTokens hold a digest, and refuse a token's text", async () => {
    const m = await minted();
    const row = { id: m.id, digest: m.digest, userId: m.user };
    expect(ApiToken.parse(row).ok).toBe(true);
    expect(ApiTokens.parse({ tokens: [row] }).ok).toBe(true);
    expect(ApiToken.parse({ ...row, digest: "keel_0_0" }).ok).toBe(false);
    expect(ApiTokens.parse({ tokens: [{ ...row, id: "" }] }).ok).toBe(false);
  });

  it("Session and Sessions need a non-empty caller", async () => {
    const m = await minted();
    expect(Session.parse({ caller: "c1", userId: m.user }).ok).toBe(true);
    expect(Sessions.parse({ sessions: [{ caller: "c1", userId: m.user }] }).ok).toBe(true);
    expect(Session.parse({ caller: "", userId: m.user }).ok).toBe(false);
    expect(Sessions.parse({ sessions: [{ caller: "c1" }] }).ok).toBe(false);
  });

  it("SignedIn has an optional email; TokenRequest is an empty object", () => {
    expect(SignedIn.parse({}).ok).toBe(true);
    expect(SignedIn.parse({ email: EMAIL }).ok).toBe(true);
    expect(SignedIn.parse({ email: 1 }).ok).toBe(false);
    expect(TokenRequest.parse({}).ok).toBe(true);
    expect(TokenRequest.parse("{}").ok).toBe(false);
  });

  it("MintedToken expires at a whole millisecond or never; Me is an email", () => {
    expect(MintedToken.parse({ token: "t", id: "i", expiresAt: 1 }).ok).toBe(true);
    expect(MintedToken.parse({ token: "t", id: "i", expiresAt: null }).ok).toBe(true);
    expect(MintedToken.parse({ token: "t", id: "i", expiresAt: 1.5 }).ok).toBe(false);
    expect(Me.parse({ email: EMAIL }).ok).toBe(true);
    expect(Me.parse({}).ok).toBe(false);
  });

  it("ErrorReply is a public KeelError; wrongCredentials is one", () => {
    expect(ErrorReply.parse(wrongCredentials)).toEqual({ ok: true, value: wrongCredentials });
    expect(ErrorReply.parse({ code: "x.y" }).ok).toBe(false);
  });
});

describe("account pages", () => {
  it("SignupPage labels its email and password fields and the submit button", () => {
    const t = render(SignupPage, { props: { data: {} } });
    expect(t.find("accounts.signup.heading").text).toBe("Create an account");
    expect(t.find("accounts.signupForm:email").name).toBe("Email");
    expect(t.find("accounts.signupForm:password").name).toBe("Password");
    expect(t.find("accounts.signupSubmit").name).toBe("Create account");
    t.dispose();
  });

  it("SigninPage names the signed-in account only when there is one", () => {
    const out = render(SigninPage, { props: { data: {} } });
    expect(out.find("accounts.signinForm:email").name).toBe("Email");
    expect(out.find("accounts.signinForm:password").name).toBe("Password");
    expect(out.find("accounts.signinSubmit").name).toBe("Sign in");
    expect(JSON.stringify(out.a11y())).not.toContain("Signed in as");
    out.dispose();
    const signed = render(SigninPage, { props: { data: { email: EMAIL } } });
    expect(signed.find("accounts.signedIn").text).toBe(`Signed in as ${EMAIL}`);
    signed.dispose();
  });
});
