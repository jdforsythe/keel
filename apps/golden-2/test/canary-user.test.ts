// k.guards Client: a `node` deployable with an identity source answers `GET /__keel/user` (header `x-keel: 1`, else 403)
// with `{ user }`, and a `client` deployable's router reads it into memory for its guards, loaders and actions.
// k.privacy: the user id is personal data. Signed in as the canary user, the `web` router runs over the real `api`;
// the entry's body and what a page renders are the only places the id may be. Every other sink is asserted on its own:
// the api's log, each URL requested or navigated to, `ctx.storage` writes, the cookies Keel set, and a session
// recording and its upload. The browser's own storage and `document.cookie` are outside an app's reach (E1601); the
// router's conformance asserts it writes neither.
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { record, session } from "@keel/std-sessions";
import { renderRoute } from "@keel/testing";
import { beforeAll, describe, expect, it } from "vitest";
import mount from "../identity.ts";
import { recipes } from "../modules/recipes/recipes.contract.ts";
import { routes } from "../modules/recipes/routes.ts";
import { type Seen, browser } from "./accountsApp.ts";
import { accountsApp } from "./accountsApp.ts";
import { CANARIES, CANARY_EMAIL, CANARY_NAME, CANARY_PASSWORD, leaked } from "./canaries.ts";
import { apiCtx } from "./simApi.ts";

const Session = s.object({ user: s.object({ id: s.string() }) });
const Entry = s.object({ user: s.string() });
const SIGNUP = mount.href("/sign-up/email", { locale: "en-US" });
const SIGNIN = mount.href("/sign-in/email", { locale: "en-US" });
const UPLOAD = () => new URL("/sessions", location.origin);

type Run = {
  userId: string;
  carried: Seen;
  refused: Seen;
  log: string[];
  /** The request line and the `x-keel` header of every request the web's router sent through its net. */
  sent: { url: string; xKeel: string | null; method: string }[];
  /** Everything the web run wrote to `ctx.storage`. */
  stored: string[];
  /** Every URL the web run navigated to or opened, and the router's match after each step. */
  navigated: string[];
  routes: string[];
  setCookies: string[];
  recording: string;
  uploaded: string;
  seenUser: number;
};

/** Sign the canary user up and in on the `api`, then run the `web` router over it with the cookie on every request. */
async function flow(seed: number): Promise<Run> {
  const server: SimCtx = apiCtx(seed);
  const { app, lines } = await accountsApp(server);
  const b = browser(app);
  const setCookies: string[] = [];
  const mark = (r: { posted: Seen; page: Seen | null }) => {
    setCookies.push(...r.posted.cookies, ...(r.page?.cookies ?? []));
  };
  mark(await b.post(SIGNUP, { name: CANARY_NAME, email: CANARY_EMAIL, password: CANARY_PASSWORD }));
  mark(await b.post(SIGNIN, { email: CANARY_EMAIL, password: CANARY_PASSWORD }));
  const who = Session.parse(JSON.parse((await b.json("GET", "/api/auth/get-session")).text));
  const userId = who.ok ? who.value.user.id : "";
  const cookie = [...b.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const carried = await b.json("GET", "/__keel/user");
  const refused = await app.fetch(
    new Request("http://localhost/__keel/user", { headers: { cookie, accept: "application/json" } }),
  );

  const web = createCtx({ mode: "sim", seed: seed + 1 });
  const sent: Run["sent"] = [];
  let seenUser = 0;
  const forward = (req: Request) => {
    const headers = new Headers(req.headers);
    headers.set("cookie", cookie);
    headers.set("sec-fetch-site", "same-origin");
    const path = new URL(req.url).pathname;
    sent.push({ url: req.url, xKeel: req.headers.get("x-keel"), method: req.method });
    if (path === "/__keel/user") seenUser += 1;
    return app.fetch(
      new Request(new URL(path + new URL(req.url).search, "http://localhost"), { method: req.method, headers }),
    );
  };
  web.net.route(new URL("/__keel/user", location.href).href, forward);
  web.net.route(new URL("/api/*", location.href).href, forward);
  const stored: string[] = [];
  const set = web.storage.set.bind(web.storage);
  web.storage.set = async (k, v) => {
    stored.push(k, v);
    return set(k, v);
  };
  const commit = web.storage.commit.bind(web.storage);
  web.storage.commit = async (writes) => {
    stored.push(JSON.stringify(writes));
    return commit(writes);
  };

  const rec = record(web, { upload: UPLOAD() });
  const t = await renderRoute("recipes.index", { routes, params: { locale: "en-US" }, ctx: web, mount: mount.path });
  const navigated: string[] = [location.href];
  const matches: string[] = [JSON.stringify(t.route())];
  const go = async (href: ReturnType<typeof recipes.href>) => {
    navigated.push(String(href));
    await t.navigate(href);
    navigated.push(location.href);
    matches.push(JSON.stringify(t.route()));
  };
  await go(recipes.href("recipes.catalog", { locale: "en-US" }, {}));
  // A recipe no one has: the loader's `keel.notFound` shows the page's error element.
  await go(recipes.href("recipes.show", { locale: "en-US", recipeId: web.random.id("Recipe") }));
  await go(recipes.href("recipes.index", { locale: "de-DE" }, {}));
  const docs = t.documents().map((d) => String(Reflect.get(Object(d), "url")));
  const entries = t.location().entries;
  t.dispose();
  const out = rec.stop();
  const put = await session(web).put(UPLOAD(), out);
  await app.close();
  expect(entries).toBeGreaterThan(1);
  expect(put.ok).toBe(true);
  return {
    userId,
    carried,
    refused: { status: refused.status, location: null, cookies: [], text: await refused.text() },
    log: lines,
    sent,
    stored,
    navigated: [...navigated, ...docs],
    routes: matches,
    setCookies,
    recording: JSON.stringify(out),
    uploaded: JSON.stringify(session(web).taken()),
    seenUser,
  };
}

describe("canaries and the user id through `/__keel/user` and the web's router", () => {
  let run: Run;
  let all: Record<string, string> = { ...CANARIES };
  beforeAll(async () => {
    run = await flow(71);
    all = { ...CANARIES, userId: run.userId };
  });

  it("carried: the run has a user id, and the entry names it only with `x-keel`", () => {
    expect(run.userId).not.toBe("");
    expect(run.carried.status).toBe(200);
    const body = Entry.parse(JSON.parse(run.carried.text));
    expect(body.ok ? body.value.user : "").toBe(run.userId);
    expect(run.refused.status).toBe(403);
    expect(leaked(run.refused.text, all)).toEqual([]);
    expect(run.log.length).toBeGreaterThan(0);
  });

  it("carried: the router read the entry with `x-keel` and navigated", () => {
    expect(run.seenUser).toBeGreaterThanOrEqual(1);
    for (const r of run.sent.filter((x) => new URL(x.url).pathname === "/__keel/user")) {
      expect(r.method).toBe("GET");
      expect(r.xKeel).toBe("1");
    }
    expect(run.navigated.length).toBeGreaterThanOrEqual(4);
    expect(run.recording).toContain("events");
  });

  it("sink: the api's log", () => {
    expect(leaked(run.log.join("\n"), all)).toEqual([]);
  });

  it("sink: each URL the router requested, navigated to or opened", () => {
    for (const u of [...run.sent.map((x) => x.url), ...run.navigated])
      expect({ url: u, leaked: leaked(u, all) }).toEqual({ url: u, leaked: [] });
  });

  it("sink: the router's matches (params, search, url)", () => {
    expect(leaked(run.routes.join("\n"), all)).toEqual([]);
  });

  it("sink: ctx.storage writes", () => {
    expect(leaked(run.stored.join("\n"), all)).toEqual([]);
  });

  it("sink: cookies Keel and the library set", () => {
    expect(leaked(run.setCookies.join("\n"), all)).toEqual([]);
    expect(leaked(run.carried.cookies.join("\n"), all)).toEqual([]);
  });

  it("sink: the entry sets no cookie", () => {
    expect(run.carried.cookies).toEqual([]);
  });

  it("sink: the session recording and the session as uploaded", () => {
    expect(leaked(run.recording, all)).toEqual([]);
    expect(leaked(run.uploaded, all)).toEqual([]);
  });
});
