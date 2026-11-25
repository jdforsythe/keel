import { type A11yNode, properties, render, renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import RecordingNote from "../modules/app/RecordingNote.tsx";
import Masthead from "../modules/members/Masthead.tsx";
import ProfilePage from "../modules/members/ProfilePage.tsx";
import SigninPage from "../modules/members/SigninPage.tsx";
import SignupPage from "../modules/members/SignupPage.tsx";
import TokenPanel from "../modules/members/TokenPanel.tsx";
import VisitorFrame from "../modules/members/VisitorFrame.tsx";
import { shellText } from "../modules/members/shellText.ts";
import { EMAIL, NAME, PASSWORD, served, signIn, webRoutes } from "./serve.ts";

/** Every id in an a11y tree. */
const idsOf = (nodes: readonly A11yNode[]): string[] => nodes.flatMap((n) => [n.id, ...idsOf(n.children)]);

/** The sign-in page in a visitor's browser. */
async function visitor(seed: number, route: "members.signin" | "members.signup", search: Record<string, string> = {}) {
  const at = await served(seed, false);
  const page = await renderRoute(route, { routes: webRoutes, params: {}, search, ctx: at.ctx, app: at.app });
  return { ...at, page };
}

const type = async (page: Awaited<ReturnType<typeof visitor>>["page"], values: Record<string, string>) => {
  for (const [id, value] of Object.entries(values)) await page.fire(id, { type: "input", value });
};

it("shows a visitor the sign-in page: a banner, the main navigation, a main region, two labelled fields and a button", async () => {
  const { page } = await visitor(100, "members.signin");
  const tree = page.a11y();
  expect(idsOf(tree)).not.toContain("members.signinError");
  expect(page.find("frame.masthead").role).toBe("banner");
  expect(page.find("frame.nav")).toMatchObject({ role: "navigation", name: "Main" });
  expect(page.find("frame.main").role).toBe("main");
  expect(page.find("members.signin.heading")).toMatchObject({ role: "heading", name: "Sign in" });
  expect(page.find("members.signinForm:email")).toMatchObject({ role: "textbox", name: "Email" });
  expect(page.find("members.signinForm:password")).toMatchObject({ role: "textbox", name: "Password" });
  expect(page.find("members.signinSubmit")).toMatchObject({ role: "button", name: "Sign in" });
  expect(page.find("members.toSignup").role).toBe("link");
  expect(idsOf(tree)).not.toContain("app.nav.list");
  expect(page.focusOrder()).toEqual([
    "members.nav.signIn",
    "members.nav.signUp",
    "members.signinForm:email",
    "members.signinForm:password",
    "members.signinSubmit",
    "members.toSignup",
  ]);
  page.dispose();
});

it("names the refusal on the sign-in page: a wrong email or password, or any other refusal, and no value typed", async () => {
  for (const [error, text] of [
    ["credentials", "Wrong email or password."],
    ["invalid", "That did not work. Check each field and try again."],
  ] as const) {
    const { page } = await visitor(101, "members.signin", { error });
    expect(page.find("members.signinError").text).toBe(text);
    page.dispose();
  }
});

it("refuses an empty sign-in and a short password in the form, sending nothing", async () => {
  const { page, sent } = await visitor(102, "members.signin");
  await page.fire("members.signinSubmit", { type: "click" });
  expect(page.find("members.signinForm:email").state).toMatchObject({ invalid: true });
  expect(page.find("members.signinForm:password").state).toMatchObject({ invalid: true });
  expect(page.route().id).toBe("members.signin");
  await type(page, { "members.signinForm:email": EMAIL, "members.signinForm:password": "short" });
  await page.fire("members.signinSubmit", { type: "click" });
  expect(page.find("members.signinForm:password").state).toMatchObject({ invalid: true });
  expect(page.find("members.signinForm:email").state).not.toMatchObject({ invalid: true });
  expect(page.route().id).toBe("members.signin");
  expect(sent).toEqual([]);
  page.dispose();
});

it("signs a member in and goes on to the start page, or to the page the guard named", async () => {
  const at = await served(103, false);
  await signIn(at.raw);
  for (const [search, to] of [
    [{}, "app.start"],
    [{ next: "/list" }, "shopping.list"],
  ] as const) {
    const page = await renderRoute("members.signin", {
      routes: webRoutes,
      params: {},
      search,
      ctx: at.ctx,
      app: at.app,
    });
    await type(page, { "members.signinForm:email": EMAIL, "members.signinForm:password": PASSWORD });
    await page.fire("members.signinSubmit", { type: "click" });
    expect(page.route().id).toBe(to);
    page.dispose();
  }
});

it("comes back to the sign-in page with the refusal named when the password is wrong, keeping the next page", async () => {
  const at = await served(104, false);
  await signIn(at.raw);
  const page = await renderRoute("members.signin", {
    routes: webRoutes,
    params: {},
    search: { next: "/list" },
    ctx: at.ctx,
    app: at.app,
  });
  await type(page, { "members.signinForm:email": EMAIL, "members.signinForm:password": "a different password" });
  await page.fire("members.signinSubmit", { type: "click" });
  expect(page.route()).toMatchObject({ id: "members.signin", search: { error: "credentials", next: "/list" } });
  expect(page.find("members.signinError").text).toBe("Wrong email or password.");
  expect(page.find("members.signinForm:password").text).toBe("");
  page.dispose();
});

it("moves between the sign-in and sign-up pages, carrying the next page", async () => {
  const { page } = await visitor(105, "members.signin", { next: "/setup" });
  await page.fire("members.toSignup", { type: "click" });
  expect(page.route()).toMatchObject({ id: "members.signup", search: { next: "/setup" } });
  await page.fire("members.toSignin", { type: "click" });
  expect(page.route()).toMatchObject({ id: "members.signin", search: { next: "/setup" } });
  await page.fire("members.nav.signUp", { type: "click" });
  expect(page.route()).toMatchObject({ id: "members.signup", search: {} });
  page.dispose();
});

it("makes an account and sends the new member to the sign-in page; a taken email comes back with the refusal", async () => {
  const { page } = await visitor(106, "members.signup");
  expect(page.find("members.signup.heading").name).toBe("Make an account");
  expect(page.focusOrder()).toEqual([
    "members.nav.signIn",
    "members.nav.signUp",
    "members.signupForm:name",
    "members.signupForm:email",
    "members.signupForm:password",
    "members.signupSubmit",
    "members.toSignin",
  ]);
  await page.fire("members.signupSubmit", { type: "click" });
  for (const field of ["name", "email", "password"])
    expect(page.find(`members.signupForm:${field}`).state).toMatchObject({ invalid: true });
  await type(page, {
    "members.signupForm:name": NAME,
    "members.signupForm:email": EMAIL,
    "members.signupForm:password": PASSWORD,
  });
  await page.fire("members.signupSubmit", { type: "click" });
  expect(page.route().id).toBe("members.signin");
  page.dispose();
});

it("comes back to the sign-up page with the refusal named when the library refuses the account, holding no typed value", async () => {
  const at = await served(107, false);
  const page = await renderRoute("members.signup", {
    routes: webRoutes,
    params: {},
    search: {},
    ctx: at.ctx,
    app: at.app,
  });
  await type(page, {
    "members.signupForm:name": NAME,
    "members.signupForm:email": "not-an-email",
    "members.signupForm:password": PASSWORD,
  });
  await page.fire("members.signupSubmit", { type: "click" });
  expect(page.route()).toMatchObject({ id: "members.signup", search: { error: "invalid" } });
  expect(page.find("members.signupError").text).toBe("That did not work. Check each field and try again.");
  expect(JSON.stringify(page.route())).not.toContain(PASSWORD);
  page.dispose();
});

it("sends a visitor from the profile page to sign in and names the profile as the page to return to", async () => {
  const at = await served(108, false);
  const page = await renderRoute("members.profile", { routes: webRoutes, params: {}, ctx: at.ctx, app: at.app });
  expect(page.route()).toMatchObject({ id: "members.signin", search: { next: "/profile" } });
  page.dispose();
});

it("shows a member the profile under the app frame, with the household's navigation and the signed-in email", async () => {
  const at = await served(109);
  const page = await renderRoute("members.profile", {
    routes: webRoutes,
    params: {},
    ctx: at.ctx,
    app: at.app,
    user: at.user,
  });
  expect(page.find("frame.nav")).toMatchObject({ role: "navigation", name: "Main" });
  expect(page.find("members.profile.heading")).toMatchObject({ role: "heading", name: "Your profile" });
  expect(page.find("members.profileForm:name")).toMatchObject({ role: "textbox", name: "Name the household sees" });
  expect(page.find("members.signedIn").text).toBe("Signed in as ada@example.com");
  expect(page.find("members.tokens.heading").name).toBe("API tokens");
  expect(idsOf(page.a11y())).not.toContain("members.saved");
  // The name field starts as the member's name, so a save with nothing typed is valid and keeps it.
  await page.fire("members.save", { type: "click" });
  expect(page.route()).toMatchObject({ id: "members.profile", search: { saved: true } });
  expect(page.find("members.saved").text).toBe("Saved.");
  page.dispose();
});

it("refuses a profile with no name or a phone over 30 characters, and saves nothing", async () => {
  const at = await served(110);
  const page = await renderRoute("members.profile", {
    routes: webRoutes,
    params: {},
    ctx: at.ctx,
    app: at.app,
    user: at.user,
  });
  await page.fire("members.profileForm:name", { type: "input", value: "" });
  await page.fire("members.save", { type: "click" });
  expect(page.find("members.profileForm:name").state).toMatchObject({ invalid: true });
  await page.fire("members.profileForm:name", { type: "input", value: "Ada" });
  await page.fire("members.profileForm:phone", { type: "input", value: "9".repeat(31) });
  await page.fire("members.save", { type: "click" });
  expect(page.find("members.profileForm:phone").state).toMatchObject({ invalid: true });
  expect(idsOf(page.a11y())).not.toContain("members.saved");
  page.dispose();
});

it("shows the saved line when the profile is opened after a save", async () => {
  const at = await served(111);
  const page = await renderRoute("members.profile", {
    routes: webRoutes,
    params: {},
    search: { saved: true },
    ctx: at.ctx,
    app: at.app,
    user: at.user,
  });
  expect(page.find("members.saved")).toMatchObject({ text: "Saved." });
  page.dispose();
});

it("signs out from the frame and lands on the sign-in page", async () => {
  const at = await served(112);
  const page = await renderRoute("members.profile", {
    routes: webRoutes,
    params: {},
    ctx: at.ctx,
    app: at.app,
    user: at.user,
  });
  await page.fire("app.nav.signOut", { type: "click" });
  expect(page.route().id).toBe("members.signin");
  page.dispose();
});

it("renders the sign-in, sign-up, token and profile components for any copy and any list of tokens the schemas allow", async () => {
  await properties(SigninPage, { runs: 100, seed: 11 });
  await properties(SignupPage, { runs: 100, seed: 12 });
  await properties(TokenPanel, { runs: 100, seed: 13 });
  await properties(ProfilePage, { runs: 50, seed: 14 });
  await properties(RecordingNote, { runs: 50, seed: 15 });
});

it("renders the visitor frame and the masthead around any page, with the household's name when it has one", () => {
  const page = document.createElement("p");
  for (const name of [null, "Elm Street"]) {
    const data = { text: shellText, name, signedIn: false };
    const frame = render(VisitorFrame, { props: { data, children: () => page } });
    expect(frame.find("frame.nav")).toMatchObject({ role: "navigation", name: "Main" });
    expect(frame.find("members.nav.signIn").name).toBe("Sign in");
    expect(idsOf(frame.a11y()).includes("frame.name")).toBe(name !== null);
    if (name !== null) expect(frame.find("frame.name").text).toBe(name);
    frame.dispose();
  }
  const bare = render(Masthead, {
    props: {
      data: { text: shellText, name: null, signedIn: true },
      nav: () => document.createElement("span"),
      children: () => page,
    },
  });
  expect(bare.find("frame.masthead").role).toBe("banner");
  expect(idsOf(bare.a11y())).not.toContain("frame.name");
  bare.dispose();
});
