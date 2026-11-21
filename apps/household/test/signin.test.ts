// @vitest-environment node
import { expect, it } from "vitest";
import mount from "../identity.ts";
import { EMAIL, NAME, PASSWORD, asJson, formPost, served } from "./serve.ts";

/** The cookie pairs `res` sets, as a `cookie` header sends them back. */
const jar = (res: Response): string =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0] ?? "")
    .join("; ");

const signUp = mount.href("/sign-up/email");

it("signs up, then signs in to the start page with a session cookie the API accepts", async () => {
  const { raw } = await served(31, false);
  const up = await raw(formPost(signUp, { name: NAME, email: EMAIL, password: PASSWORD }));
  expect(up.status).toBe(303);
  expect(up.headers.get("location")).toBe("/signin");
  expect(up.headers.getSetCookie()).toEqual([]);
  const signedIn = await raw(formPost(mount.href("/sign-in/email"), { email: EMAIL, password: PASSWORD }));
  expect(signedIn.status).toBe(303);
  expect(signedIn.headers.get("location")).toBe("/");
  const cookies = signedIn.headers.getSetCookie();
  expect(cookies.length).toBeGreaterThan(0);
  expect(cookies.every((c) => /HttpOnly/i.test(c) && /SameSite=Lax/i.test(c))).toBe(true);
  expect((await raw(asJson("GET", "/api/items", undefined, { cookie: jar(signedIn) }))).status).toBe(200);
});

it("goes on to the page the guard named, and only to a page on this origin", async () => {
  const { raw } = await served(32, false);
  await raw(formPost(signUp, { name: NAME, email: EMAIL, password: PASSWORD }));
  const to = async (next: string) =>
    (await raw(formPost(mount.href("/sign-in/email", { next }), { email: EMAIL, password: PASSWORD }))).headers.get(
      "location",
    );
  expect(await to("/list")).toBe("/list");
  expect(await to("/de-DE/receipts")).toBe("/de-DE/receipts");
  expect(await to("//evil.example/x")).toBe("/");
  expect(await to("https://evil.example/")).toBe("/");
});

it("refuses a wrong password with no cookie and no typed value in the URL", async () => {
  const { raw } = await served(33, false);
  await raw(formPost(signUp, { name: NAME, email: EMAIL, password: PASSWORD }));
  const wrong = await raw(
    formPost(mount.href("/sign-in/email", { next: "/list" }), { email: EMAIL, password: "a wrong password" }),
  );
  expect(wrong.status).toBe(303);
  expect(wrong.headers.get("location")).toBe("/signin?error=credentials&next=%2Flist");
  expect(wrong.headers.getSetCookie()).toEqual([]);
  const page = await (await raw(new Request("http://localhost/signin?error=credentials"))).text();
  expect(page).toContain('id="members.signinError"');
  expect(page).not.toContain("a wrong password");
});

it("signs out: the cookie no longer reaches the API", async () => {
  const { raw } = await served(34, false);
  await raw(formPost(signUp, { name: NAME, email: EMAIL, password: PASSWORD }));
  const cookie = jar(await raw(formPost(mount.href("/sign-in/email"), { email: EMAIL, password: PASSWORD })));
  const out = await raw(formPost(mount.href("/sign-out"), {}, cookie));
  expect(out.status).toBe(303);
  expect(out.headers.get("location")).toBe("/signin");
  expect((await raw(asJson("GET", "/api/items", undefined, { cookie }))).status).toBe(403);
});

it("refuses a cross-site sign-in post before the library sees it", async () => {
  const { raw } = await served(35, false);
  const res = await raw(
    new Request(`http://localhost${mount.href("/sign-in/email")}`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "sec-fetch-site": "cross-site",
        origin: "https://evil.example",
      },
      body: new URLSearchParams({ email: EMAIL, password: PASSWORD }).toString(),
    }),
  );
  expect(res.status).toBe(403);
});
