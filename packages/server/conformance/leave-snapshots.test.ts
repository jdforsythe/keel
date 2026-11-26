import { fixedTime } from "@keel/tooling/test-time";
import { scope } from "@keel/reactive";
// @vitest-environment happy-dom
// k.leave, Snapshots "`#k-state` `stores` holds a request store's snapshot only when an island needs it to resume: the store was created, looked up through `stores()` or read (`get`, `select`, `snapshot`, `log`, `head`) while a level's component rendered on the server, that level being an island root (k.runtime). A store only a guard, loader, action or static level touched is not in it, however much it holds; nor is a factory store (k.server). A document with no island has `stores` `{}`. `#k-state` is not a k.privacy sink: a snapshot holds the store's state and log as they are, so a `.pii()`-marked value in a store an island creates reaches the browser, as the island needs it to render. The check reports E1107 (below). No `s.secret` value reaches a snapshot: a state schema holding one throws E1303, and a snapshot folds every log entry up to the last secret payload (k.store)."
// Spec: k.leave, clause "A route whose loader creates stores `a` (a `.pii('contact')` field) and `p`, and whose island page's component reads `p` and creates `b`, serves `#k-state` `stores` with `b` and `p` only; with a static page instead, the document has no module script and `stores` is `{}`."
// Spec: k.leave, clause "A static layout whose render creates store `c`, around an island page that creates `b`: `stores` has `b`, not `c`; the value of a `.pii('contact')` field of `b` is in `#k-state` as the page rendered it."
// Seed: 1337 (the property below). Real createApp output under a sim ctx; the documents are parsed, never hand-written.
import { type Guard, type Loader, guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { store } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, compileLevel, hasModuleScript, islandPage, stateOf, staticLayout, staticPage } from "./leave-support.ts";
import { serveRoutes } from "./resume-graph-app.ts";

const Data = s.object({ title: s.string() });
const Contact = s.object({ email: s.string().pii("contact") });
const Count = s.object({ n: s.int() });
const MODULES = ["ls"];
const LOGIN = { path: "/login", source: staticPage("") };
// Every level the tests use is an entry of this one contract; a test binds the ones it needs and the rest get a static default.
const lsContract = contract("ls", {
  "ls.layout": { layout: true },
  "ls.login": { path: "/login" },
  "ls.page": { path: "/" },
});
type Ctr = typeof lsContract;

/** A loader that creates `ls.a` (a contact) and `ls.p` (a count). */
const seeding = (email: string) => (c: Ctr) =>
  loader(c, "ls.page", { output: Data }, () => {
    store(Contact, { email }, { id: "ls.a" });
    store(Count, { n: 3 }, { id: "ls.p" });
    return Promise.resolve(ok({ title: "t" }));
  });

const BOB = 'const b = store(s.object({ email: s.string().pii("contact") }), { email: "bob@x.test" }, { id: "ls.b" });';
const READS_P = 'const p = stores().get("ls.p"); const seen = p === undefined ? 0 : p.get("n");';

const factory = () => ({ f: store(Count, { n: 7 }, { id: "ls.factory" }) });
/** A loader with a `stores` factory: its store is not a request store of the registry. */
const viaFactory = (c: Ctr) =>
  loader(c, "ls.page", { output: Data, stores: factory }, ({ stores }) => {
    void stores.f.get("n");
    return Promise.resolve(ok({ title: "t" }));
  });

type Level = {
  path?: string;
  layout?: "ls.layout";
  source: string;
  guard?: Guard;
  loader?: (c: Ctr) => Loader<"ls.page", unknown, false>;
};
type Levels = Partial<Record<"ls.layout" | "ls.login" | "ls.page", Level>>;

function routesOf(levels: Levels) {
  const layout = levels["ls.layout"] ?? { source: staticLayout("") };
  const login = levels["ls.login"] ?? LOGIN;
  const page = levels["ls.page"] ?? { source: staticPage("") };
  return manifest(lsContract, {
    "ls.layout": { component: compileLevel("ls.layout", layout.source) },
    "ls.login": { component: compileLevel("ls.login", login.source) },
    "ls.page": {
      component: compileLevel("ls.page", page.source),
      ...(page.layout === undefined ? {} : { layout: page.layout }),
      ...(page.guard === undefined ? {} : { guard: page.guard }),
      ...(page.loader === undefined ? {} : { loader: page.loader(lsContract) }),
    },
  });
}

async function get(levels: Levels, path: string) {
  const doc = await serveRoutes(routesOf(levels), MODULES, path, { mode: "production" });
  expect(doc.status).toBe(200);
  return doc;
}

const idsOf = (text: string): string[] => Object.keys(stateOf(text).stores).sort();

describe("k.leave Snapshots: #k-state carries a request store only when an island level's render touched it", () => {
  it("a loader creates `a` (a `.pii('contact')` field) and `p`; the island page reads `p` and creates `b`: stores holds `b` and `p` only, and `a`'s email is nowhere in the document", async () => {
    const doc = await get(
      { "ls.page": { path: "/", source: islandPage(`${READS_P} ${BOB}`), loader: seeding("alice@x.test") } },
      "/",
    );
    expect(hasModuleScript(doc.text)).toBe(true);
    expect(idsOf(doc.text)).toEqual(["ls.b", "ls.p"]);
    expect(doc.text).not.toContain("alice@x.test");
  });

  it("the same loader with a static page: no module script, stores is {}, and the email is nowhere in the document", async () => {
    const doc = await get({ "ls.page": { path: "/", source: staticPage(""), loader: seeding("alice@x.test") } }, "/");
    expect(hasModuleScript(doc.text)).toBe(false);
    expect(stateOf(doc.text).stores).toEqual({});
    expect(doc.text).not.toContain("alice@x.test");
  });

  it("a static layout whose render creates `c`, around an island page that creates `b`: stores holds `b`, not `c`, and b's `.pii('contact')` value is in #k-state as rendered", async () => {
    const doc = await get(
      {
        "ls.layout": { source: staticLayout('const c = store(s.object({ k: s.int() }), { k: 1 }, { id: "ls.c" });') },
        "ls.page": { path: "/", layout: "ls.layout", source: islandPage(BOB) },
      },
      "/",
    );
    expect(idsOf(doc.text)).toEqual(["ls.b"]);
    const b = stateOf(doc.text).stores["ls.b"];
    expect(JSON.stringify(b)).toContain("bob@x.test");
    expect(Reflect.get(Object(Reflect.get(Object(b), "state")), "email")).toBe("bob@x.test");
  });

  it.each([
    ["get", 'p.get("n")'],
    ["select", "p.select((st) => st.n)"],
    ["snapshot", "p.snapshot()"],
    ["log", "p.log()"],
    ["head", "p.head()"],
  ])("a store an island page only reads with `%s` is in stores", async (_op, read) => {
    const doc = await get(
      {
        "ls.page": {
          path: "/",
          source: islandPage(`const p = stores().get("ls.p"); const seen = ${read};`),
          loader: seeding("alice@x.test"),
        },
      },
      "/",
    );
    expect(idsOf(doc.text)).toEqual(["ls.p"]);
    expect(doc.text).not.toContain("alice@x.test");
  });

  it("a store an island page only looks up through `stores()` and never reads is in stores", async () => {
    const doc = await get(
      {
        "ls.page": {
          path: "/",
          source: islandPage('const p = stores().get("ls.p");'),
          loader: seeding("alice@x.test"),
        },
      },
      "/",
    );
    expect(idsOf(doc.text)).toEqual(["ls.p"]);
  });

  it("a factory store (`stores` option of a loader) an island page reads is not in stores", async () => {
    const doc = await get(
      {
        "ls.page": {
          path: "/",
          source: islandPage('const f = stores().get("ls.factory"); const seen = f === undefined ? 0 : f.get("n");'),
          loader: viaFactory,
        },
      },
      "/",
    );
    expect(idsOf(doc.text)).not.toContain("ls.factory");
  });

  it("negative: a guard that creates `g` for an auth lookup, then an island page: `g` is absent", async () => {
    const auth = guard({ redirect: "ls.login" }, () => {
      scope(() => store(Count, { n: 9 }, { id: "ls.g" }));
      return Promise.resolve(ok(null));
    });
    const levels = routesOf({
      "ls.login": LOGIN,
      "ls.page": { path: "/", source: islandPage(BOB), guard: auth },
    });
    const doc = await serveRoutes(levels, MODULES, "/", { mode: "production" });
    expect(doc.status).toBe(200);
    expect(idsOf(doc.text)).toEqual(["ls.b"]);
  });

  it("negative: a store a static level reads and an island level never touches is absent", async () => {
    const doc = await get(
      {
        "ls.layout": { source: staticLayout(READS_P) },
        "ls.page": { path: "/", layout: "ls.layout", source: islandPage(""), loader: seeding("alice@x.test") },
      },
      "/",
    );
    expect(stateOf(doc.text).stores).toEqual({});
  });

  it(
    "property: for any email, a loader's `.pii('contact')` store never reaches a static page or an island page that does not touch it",
    async () => {
      const emails = fc.stringMatching(/^[a-z]{5,10}@[a-z]{3,6}\.test$/);
      await fc.assert(
        fc.asyncProperty(emails, fc.boolean(), async (email, island) => {
          const doc = await get(
            { "ls.page": { path: "/", source: island ? islandPage("") : staticPage(""), loader: seeding(email) } },
            "/",
          );
          expect(stateOf(doc.text).stores).toEqual({});
          expect(doc.text).not.toContain(email);
        }),
        { seed: SEED, numRuns: 12 },
      );
    },
    fixedTime(120_000),
  );
});
