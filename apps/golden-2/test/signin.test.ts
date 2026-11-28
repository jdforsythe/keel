// @vitest-environment node
import { describe, expect, it } from "vitest";
import mount from "../identity.ts";
import { BASE, EMAIL, NAME, PASSWORD, accountsApp, browser } from "./accountsApp.ts";
import { apiCtx } from "./simApi.ts";

const SIGNUP = mount.href("/sign-up/email", { locale: "en-US" });
const SIGNIN = mount.href("/sign-in/email", { locale: "en-US" });
const SIGNOUT = mount.href("/sign-out", { locale: "en-US" });

async function fresh(seed: number) {
  const { app, lines } = await accountsApp(apiCtx(seed));
  return { app, lines, b: browser(app) };
}

describe("sign-up, sign-in and sign-out through the identity mount", () => {
  it("signs up, signs in with the same password and the sign-in page names the account", async () => {
    const { b } = await fresh(41);
    const up = await b.post(SIGNUP, { name: NAME, email: EMAIL, password: PASSWORD });
    expect(up.posted.status).toBe(303);
    expect(up.posted.location).toBe("/account/signin");
    expect(b.jar.size).toBe(0);
    const signin = await b.post(SIGNIN, { email: EMAIL, password: PASSWORD });
    expect(signin.posted.status).toBe(303);
    expect(signin.posted.location).toBe("/account/signin");
    expect(signin.posted.cookies.length).toBeGreaterThan(0);
    expect(signin.posted.cookies.every((c) => /HttpOnly/i.test(c) && /SameSite=Lax/i.test(c))).toBe(true);
    expect(signin.page?.status).toBe(200);
    expect(signin.page?.text).toContain(`Signed in as ${EMAIL}`);
    expect(signin.page?.text).toContain('id="accounts.signOut"');
    const me = await b.json("GET", "/api/me");
    expect(me.status).toBe(200);
    expect(me.text).toContain(EMAIL);
  });

  it("a wrong password signs no one in, the page shows the error, and no URL holds what was typed", async () => {
    const { b } = await fresh(42);
    await b.post(SIGNUP, { name: NAME, email: EMAIL, password: PASSWORD });
    const wrong = await b.post(SIGNIN, { email: EMAIL, password: "a wrong password" });
    expect(wrong.posted.status).toBe(303);
    expect(wrong.posted.location).toBe("/account/signin?error=credentials");
    expect(wrong.posted.cookies).toEqual([]);
    expect(wrong.page?.text).toContain('id="accounts.signinError"');
    expect(wrong.page?.text).toContain("Wrong email or password");
    expect(wrong.page?.text).not.toContain("a wrong password");
    expect(wrong.page?.text).not.toContain('id="accounts.signedIn"');
    const unknown = await b.post(SIGNIN, { email: "bob@example.com", password: PASSWORD });
    expect(unknown.posted.location).toBe(wrong.posted.location);
    expect((await b.json("GET", "/api/me")).status).toBe(403);
  });

  it("a second sign-up with a known email looks like the first and changes nothing; a short password is refused", async () => {
    const { b } = await fresh(43);
    const first = await b.post(SIGNUP, { name: NAME, email: EMAIL, password: PASSWORD });
    const again = await b.post(SIGNUP, { name: "Mallory", email: EMAIL, password: "another password" });
    expect(again.posted.status).toBe(first.posted.status);
    expect(again.posted.location).toBe(first.posted.location);
    const theirs = await b.post(SIGNIN, { email: EMAIL, password: "another password" });
    expect(theirs.posted.location).toBe("/account/signin?error=credentials");
    expect((await b.post(SIGNIN, { email: EMAIL, password: PASSWORD })).page?.text).toContain('id="accounts.signedIn"');
    const short = await b.post(SIGNUP, { name: NAME, email: "c@example.com", password: "short" });
    expect(short.posted.location).toBe("/account/signup?error=invalid");
  });

  it("sign-out ends the session: the page is signed out and the old cookie no longer identifies", async () => {
    const { b } = await fresh(44);
    await b.post(SIGNUP, { name: NAME, email: EMAIL, password: PASSWORD });
    await b.post(SIGNIN, { email: EMAIL, password: PASSWORD });
    const kept = new Map(b.jar);
    expect((await b.json("GET", "/api/me")).status).toBe(200);
    const out = await b.post(SIGNOUT, {});
    expect(out.posted.status).toBe(303);
    expect(out.posted.location).toBe("/account/signin");
    expect(out.page?.text).not.toContain('id="accounts.signedIn"');
    expect((await b.json("GET", "/api/me")).status).toBe(403);
    for (const [k, v] of kept) b.jar.set(k, v);
    expect((await b.json("GET", "/api/me")).status).toBe(403);
  });

  it("serves the pages in each locale and sends a refusal back to the posting page's locale", async () => {
    const { b } = await fresh(45);
    const de = await b.send("/de-DE/account/signin");
    expect(de.status).toBe(200);
    expect(de.text).toContain('<html lang="de-DE">');
    expect(de.text).toContain("<title>Anmelden · Keel</title>");
    expect(de.text).toContain(`action="${mount.href("/sign-in/email", { locale: "de-DE" })}"`);
    const ja = await b.send("/ja-JP/account/signup");
    expect(ja.text).toContain("アカウント作成");
    const wrong = await b.post(mount.href("/sign-in/email", { locale: "de-DE" }), { email: EMAIL, password: PASSWORD });
    expect(wrong.posted.location).toBe("/de-DE/account/signin?error=credentials");
    expect(wrong.page?.text).toContain("E-Mail oder Passwort falsch");
  });

  it("refuses a cross-site post to the mount before the library sees it", async () => {
    const { app } = await fresh(46);
    const res = await app.fetch(
      new Request(`${BASE}${SIGNUP}`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: "https://evil.example",
          "sec-fetch-site": "cross-site",
        },
        body: new URLSearchParams({ name: NAME, email: EMAIL, password: PASSWORD }).toString(),
      }),
    );
    expect(res.status).toBe(403);
    const b = browser(app);
    expect((await b.post(SIGNIN, { email: EMAIL, password: PASSWORD })).posted.location).toBe(
      "/account/signin?error=credentials",
    );
  });

  it("passes a JSON call to the library through unchanged", async () => {
    const { b } = await fresh(47);
    const up = await b.json(
      "POST",
      "/api/auth/sign-up/email",
      { origin: BASE },
      { name: NAME, email: EMAIL, password: PASSWORD },
    );
    expect(up.status).toBe(200);
    expect(up.location).toBeNull();
    const signin = await b.json(
      "POST",
      "/api/auth/sign-in/email",
      { origin: BASE },
      { email: EMAIL, password: PASSWORD },
    );
    expect(signin.status).toBe(200);
    expect(signin.cookies.length).toBeGreaterThan(0);
    const session = await b.json("GET", "/api/auth/get-session");
    expect(session.status).toBe(200);
    expect(session.text).toContain(EMAIL);
    expect((await b.json("GET", "/api/me")).status).toBe(200);
  });

  it("writes neither the email, the name nor the password to the server log", async () => {
    const { b, lines } = await fresh(48);
    await b.post(SIGNUP, { name: NAME, email: EMAIL, password: PASSWORD });
    await b.post(SIGNIN, { email: EMAIL, password: "a wrong password" });
    await b.post(SIGNIN, { email: EMAIL, password: PASSWORD });
    await b.json("GET", "/api/me");
    await b.post(SIGNOUT, {});
    const log = lines.join("\n");
    for (const canary of [EMAIL, NAME, PASSWORD, "a wrong password"]) expect(log).not.toContain(canary);
  });
});
