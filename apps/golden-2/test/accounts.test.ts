import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { isolate } from "@keel/store";
import { properties, renderRoute } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { Users } from "../modules/accounts/Users.schema.ts";
import { accountStores } from "../modules/accounts/accountStores.ts";
import { routes } from "../modules/accounts/routes.ts";

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
    await properties(fresh().addUser);
  });
  it("setPassword keeps the users invariant", async () => {
    await properties(fresh().setPassword);
  });
  it("signIn keeps one session per caller", async () => {
    await properties(fresh().signIn);
  });
  it("addToken keeps token ids unique", async () => {
    await properties(fresh().addToken);
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
    expect(wrongText).toBe("Wrong email or password");
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
