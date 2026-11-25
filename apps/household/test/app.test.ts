import { gen } from "@keel/schema/gen";
import { type SessionEvent, SessionEvent as SessionEventSchema } from "@keel/std-sessions";
import { type A11yNode, properties, render, renderRoute } from "@keel/testing";
import fc from "fast-check";
import { expect, it } from "vitest";
import AppFrame from "../modules/app/AppFrame.tsx";
import RecordingNote from "../modules/app/RecordingNote.tsx";
import { StartData } from "../modules/app/StartData.schema.ts";
import StartPage from "../modules/app/StartPage.tsx";
import { eventLine } from "../modules/app/eventLine.ts";
import { loadFrame } from "../modules/app/loadFrame.server.ts";
import { loadStart } from "../modules/app/loadStart.server.ts";
import { shellText } from "../modules/members/shellText.ts";
import { SEED } from "./schemas.ts";
import { served, webRoutes } from "./serve.ts";

const find = (nodes: readonly A11yNode[], id: string): A11yNode | undefined => {
  for (const n of nodes) {
    if (n.id === id) return n;
    const inside = find(n.children, id);
    if (inside !== undefined) return inside;
  }
  return undefined;
};
const idsOf = (nodes: readonly A11yNode[]): string[] => nodes.flatMap((n) => [n.id, ...idsOf(n.children)]);

const args = (user: string) => ({ params: {}, search: {}, url: "http://localhost/", caller: "c", user });

it("writes one line for each kind of recorded event, naming what it touched and the value as it was kept", () => {
  const at = 1;
  const lines: [SessionEvent, string][] = [
    [{ at, kind: "nav", href: "/list" }, "nav /list"],
    [{ at, kind: "fire", id: "a", event: { type: "click" } }, "click a"],
    [{ at, kind: "fire", id: "a", event: { type: "input", value: "xxx" } }, 'input a "xxx"'],
    [{ at, kind: "fire", id: "a", event: { type: "keydown", key: "Enter" } }, 'keydown a "Enter"'],
    [{ at, kind: "fire", id: "a", event: { type: "submit" } }, "submit a"],
    [{ at, kind: "fire", id: "a", event: { type: "blur" } }, "blur a"],
    [
      { at, kind: "tx", store: "s", name: "shopping.view.show", payload: { show: "bought" } },
      'tx shopping.view.show {"show":"bought"}',
    ],
    [{ at, kind: "resource", id: "r", state: "loading" }, "resource r loading"],
    [{ at, kind: "error", route: "x", error: { code: "keel.denied", message: "m", data: null } }, "error keel.denied"],
    [{ at, kind: "net", online: true }, "net online"],
    [{ at, kind: "net", online: false }, "net offline"],
  ];
  for (const [event, line] of lines) expect(eventLine(event)).toBe(line);
});

it("writes a single line starting with its event's kind for any recorded event, and quotes a typed value so a newline cannot split it", () => {
  fc.assert(
    fc.property(gen(SessionEventSchema), (event) => {
      const line = eventLine(event);
      expect(line).not.toContain("\n");
      expect(line.length).toBeGreaterThan(0);
      if (event.kind === "fire" && event.event.type === "input")
        expect(line).toBe(`input ${event.id} ${JSON.stringify(event.event.value)}`);
      if (event.kind === "nav") expect(line).toBe(`nav ${event.href}`);
    }),
    { numRuns: 300, seed: SEED },
  );
  expect(eventLine({ at: 0, kind: "fire", id: "f", event: { type: "input", value: "a\nb" } })).toBe('input f "a\\nb"');
});

it("loads the start page's words and the frame's data for a member and a visitor", async () => {
  const at = await served(120);
  const start = await loadStart.run(args(""), at.ctx);
  expect(start).toMatchObject({ ok: true, value: { heading: "Household", toList: "Open the shopping list" } });
  expect(start.ok && StartData.parse(start.value).ok).toBe(true);
  const before = await loadFrame.run(args(at.user), at.ctx);
  expect(before).toEqual({ ok: true, value: { text: shellText, name: null, signedIn: true } });
  expect(await loadFrame.run(args(""), at.ctx)).toMatchObject({ ok: true, value: { signedIn: false } });
});

it("shows a visitor the start page with the sign-in and sign-up links and no member navigation", async () => {
  const at = await served(121, false);
  const page = await renderRoute("app.start", { routes: webRoutes, params: {}, ctx: at.ctx, app: at.app });
  expect(page.find("app.start.heading")).toMatchObject({ role: "heading", name: "Household" });
  expect(page.find("frame.nav")).toMatchObject({ role: "navigation", name: "Main" });
  expect(page.find("app.nav.signIn").name).toBe("Sign in");
  expect(page.find("app.nav.signUp").name).toBe("Make an account");
  const ids = idsOf(page.a11y());
  for (const gone of [
    "app.nav.list",
    "app.nav.receipts",
    "app.nav.setup",
    "app.nav.profile",
    "app.nav.signOut",
    "frame.name",
  ])
    expect(ids).not.toContain(gone);
  await page.fire("app.nav.signUp", { type: "click" });
  expect(page.route().id).toBe("members.signup");
  page.dispose();
});

it("shows a member the frame's navigation, and each start-page link goes to its page, the guarded ones included", async () => {
  const at = await served(122);
  const open = () =>
    renderRoute("app.start", { routes: webRoutes, params: {}, ctx: at.ctx, app: at.app, user: at.user });
  const first = await open();
  expect(first.focusOrder()).toEqual([
    "app.nav.list",
    "app.nav.receipts",
    "app.nav.setup",
    "app.nav.profile",
    "app.nav.signOut",
    "app.start.toList",
    "app.start.toReceipts",
    "app.start.toSetup",
    "app.start.toProfile",
    "app.recording.note.button",
  ]);
  first.dispose();
  for (const [link, to] of [
    ["app.start.toList", "shopping.list"],
    ["app.start.toReceipts", "receipts.book"],
    ["app.start.toSetup", "setup.form"],
    ["app.start.toProfile", "members.profile"],
    ["app.nav.list", "shopping.list"],
    ["app.nav.setup", "setup.form"],
  ] as const) {
    const page = await open();
    await page.fire(link, { type: "click" });
    expect(page.route().id).toBe(to);
    page.dispose();
  }
});

it("names the household in the frame once it is set up, on every page under it", async () => {
  const at = await served(123);
  const setup = await renderRoute("setup.form", {
    routes: webRoutes,
    params: {},
    ctx: at.ctx,
    app: at.app,
    user: at.user,
  });
  expect(idsOf(setup.a11y())).not.toContain("frame.name");
  await setup.fire("setup.form:name", { type: "input", value: "Elm Street" });
  await setup.fire("setup.save", { type: "click" });
  setup.dispose();
  const start = await renderRoute("app.start", {
    routes: webRoutes,
    params: {},
    ctx: at.ctx,
    app: at.app,
    user: at.user,
  });
  expect(start.find("frame.name").text).toBe("Elm Street");
  start.dispose();
});

it("keeps a note of what the page records: closed until opened, empty at first, then the newest twelve events", async () => {
  const at = await served(124);
  const page = await renderRoute("app.start", {
    routes: webRoutes,
    params: {},
    ctx: at.ctx,
    app: at.app,
    user: at.user,
  });
  expect(page.find("app.recording")).toMatchObject({ role: "complementary", name: "What this page records" });
  expect(page.find("app.recording.note.button").state).toMatchObject({ expanded: false });
  await page.fire("app.recording.note.button", { type: "click" });
  expect(page.find("app.recording.note.button").state).toMatchObject({ expanded: true });
  expect(page.find("app.recording.body").text).toContain("masked before it is kept");
  expect(page.find("app.recording.count")).toMatchObject({ role: "status" });
  for (let i = 0; i < 14; i += 1) await page.fire("app.recording.note.button", { type: "click" });
  expect(page.find("app.recording.events").role).toBe("list");
  // Each click kept two events, a fire and the transaction it ran: twelve lines are six of each.
  const lines = page.find("app.recording.events").text;
  expect(lines.match(/click app\.recording\.note\.button/g)).toHaveLength(6);
  expect(lines.match(/tx headless\.open:app\.recording\.note\.toggle \{\}/g)).toHaveLength(6);
  expect(page.find("app.recording.count").text).toBe("30 events kept");
  page.dispose();
});

it("renders the start page, the frame and the recording note for any copy the schemas allow", async () => {
  await properties(StartPage, { runs: 100, seed: 21 });
  await properties(RecordingNote, { runs: 50, seed: 23 });
});

it("renders the frame around any page for a member and for a visitor, each with its own links", () => {
  const body = document.createElement("p");
  const member = render(AppFrame, {
    props: { data: { text: shellText, name: "Elm Street", signedIn: true }, children: () => body },
  });
  expect(member.focusOrder()).toEqual([
    "app.nav.list",
    "app.nav.receipts",
    "app.nav.setup",
    "app.nav.profile",
    "app.nav.signOut",
    "app.recording.note.button",
  ]);
  expect(member.find("frame.name").text).toBe("Elm Street");
  member.dispose();
  const visitor = render(AppFrame, {
    props: { data: { text: shellText, name: null, signedIn: false }, children: () => body },
  });
  expect(visitor.focusOrder()).toEqual(["app.nav.signIn", "app.nav.signUp", "app.recording.note.button"]);
  visitor.dispose();
});
