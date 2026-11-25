// @vitest-environment happy-dom
// Spec: k.mount, Conformance "One page module under `renderRoute` and served by `createApp` then `resumeDocument` records equal `documents()` for equal input."
// Spec: k.mount, Origins "`href` resolves against the page's origin, which must mount `handle`: every `node` deployable does (k.user), a `client` one through its `servedBy`."
// Spec: k.mount, Navigation "Without a router (a server-rendered page) links and an action's 303 are the browser's."
// Spec: k.mount, Testing "`renderRoute` and `resumeDocument` handles have `documents()`: the document navigations the page started, in order, `{ method, url, body }` (`body` the urlencoded text, `null` for a GET); none is made and the page stays."
// Not testable here: "Cookies are per origin ... an app serves one public origin and forwards to peers" is a rule of deployment (no check sees the deploy's origins).
// Seed 1337 (fc.assert below). The page module is packages/testing/conformance/mount-pages.ts: compiled TSX, so the one module runs in a client router
// (`renderRoute`), is rendered by `createApp` and is resumed in a graph of its own, where no router encloses its Form.
// `renderRoute` stands for the page on a `client` deployable and `createApp` for it on a `node` one; the entries it records are then sent to a
// `node` deployable that mounts `handle` and, in the second topology, hosts the `client` one.
import { createCtx } from "@keel/ctx";
import { manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { identity, topology } from "@keel/server";
import { resumeDocument } from "@keel/testing";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import {
  INVALID,
  MOUNT_PATH,
  SEED,
  VALID,
  closeAll,
  mount,
  open,
  routes,
} from "../../testing/conformance/mount-pages.ts";
import { appOf } from "./resume-graph-app.ts";
import { createAppLoose } from "./topology-fixtures.ts";

afterEach(closeAll);

const FRESH = () => import("../../testing/conformance/mount-pages.ts");
const BASE = "http://localhost";
const FORM = "application/x-www-form-urlencoded";

async function served(path: string): Promise<string> {
  const app = await appOf(routes, ["mt"]);
  const res = await app.fetch(new Request(`${BASE}${path}`, { headers: { accept: "text/html" } }));
  expect(res.status).toBe(200);
  return res.text();
}

type Entry = { readonly method: string; readonly url: string; readonly body: string | null };
type Typed = { readonly email: string; readonly password: string };

/** The documents a sign-in page starts for `input`, in a client router. */
async function renderedPost(input: Typed): Promise<readonly Entry[]> {
  const h = await open("mt.signin");
  await h.fire("mt.signin.email", { type: "input", value: input.email });
  await h.fire("mt.signin.password", { type: "input", value: input.password });
  await h.fire("mt.signin.submit", { type: "click" });
  const out = h.documents();
  h.dispose();
  return out;
}

/** The same input on the document `createApp` served, resumed in a graph of its own. */
async function resumedPost(html: string, input: Typed): Promise<readonly Entry[]> {
  const t = await resumeDocument(html, { routes: FRESH });
  await t.fire("mt.signin.email", { type: "input", value: input.email });
  await t.fire("mt.signin.password", { type: "input", value: input.password });
  await t.fire("mt.signin.submit", { type: "click" });
  const out = t.documents();
  t.dispose();
  return out;
}

/** Generated inputs the property case runs. */
const RUNS = 12;
/**
 * What the generated-input case bounds: per run, one renderRoute and one resumeDocument of the sign-in page, three
 * fires each, about 60 ms here on a quiet machine and up to 120 ms beside other work. The bound is 1,500 ms a run, so a
 * runner ten times slower (scale 0.1) still has 150 ms a run.
 */
const GENERATED_BOUND = RUNS * 1_500;

describe("k.mount: one page module records equal documents() under renderRoute and under createApp then resumeDocument", () => {
  it("for invalid input both record nothing, and for valid input both record the one POST to the mount", async () => {
    const html = await served("/sign-in");
    expect(await renderedPost(INVALID)).toEqual([]);
    expect(await resumedPost(html, INVALID)).toEqual([]);
    const post = [{ method: "POST", url: `${MOUNT_PATH}/sign-in/email`, body: "email=a%40b.example&password=pw" }];
    expect(await renderedPost(VALID)).toEqual(post);
    expect(await resumedPost(html, VALID)).toEqual(post);
  });

  it(
    "for generated input, valid or not, the two placements record equal documents()",
    async () => {
      const html = await served("/sign-in");
      const typed = fc.record({
        email: fc.stringMatching(/^[a-z0-9@.]{0,8}$/),
        password: fc.stringMatching(/^[a-z0-9]{0,5}$/),
      });
      await fc.assert(
        fc.asyncProperty(typed, async (input) => {
          const rendered = await renderedPost(input);
          const resumed = await resumedPost(html, input);
          expect(resumed).toEqual(rendered);
          expect(rendered.length).toBe(input.email.length >= 3 && input.password.length >= 2 ? 1 : 0);
        }),
        { seed: SEED, numRuns: RUNS },
      );
    },
    GENERATED_BOUND,
  );

  it("a Link to the mount records one GET in both, and the served link is the mount's Href as written", async () => {
    const html = await served("/");
    expect(html).toContain(`href="${mount.href("/login/github", { next: "a b" })}"`);
    const h = await open("mt.home");
    await h.fire("mt.home.github", { type: "click" });
    const rendered = h.documents();
    h.dispose();
    const t = await resumeDocument(html, { routes: FRESH });
    await t.fire("mt.home.github", { type: "click" });
    expect(t.documents()).toEqual(rendered);
    expect(rendered).toEqual([{ method: "GET", url: "/api/auth/login/github?next=a%20b", body: null }]);
    t.dispose();
  });

  it("a server-rendered sign-in page posts natively: its form's action is the mount's Href, method post, and no `_method` field", async () => {
    const html = await served("/sign-in");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const form = doc.querySelector("form");
    expect(form?.getAttribute("action")).toBe(`${MOUNT_PATH}/sign-in/email`);
    expect(form?.getAttribute("method")?.toLowerCase()).toBe("post");
    expect(doc.querySelector('input[name="_method"]')).toBeNull();
  });
});

describe("k.mount: the entries a page records reach a node deployable that mounts handle, as itself or as the host of a client deployable", () => {
  const page = (): Node => document.createElement("main");
  const acctContract = contract("acct", { "acct.home": { path: "/acct" } });
  const mtContract = contract("mt", { "mt.home": { path: "/" } });
  const hosted = routeTable(
    manifest(acctContract, { "acct.home": { component: page } }),
    manifest(mtContract, { "mt.home": { component: page } }),
  );
  const placements = {
    node: { api: { modules: ["acct", "mt"], adapter: "node" as const } },
    "client hosted by node": {
      api: { modules: ["acct"], adapter: "node" as const },
      web: { modules: ["mt"], adapter: "client" as const, servedBy: "api" },
    },
  };

  for (const [name, deployables] of Object.entries(placements)) {
    it(`on ${name}: the form's POST and the link's GET reach \`fn\` at the mount with the fields as typed`, async () => {
      const seenByFn: { method: string; path: string; search: string; body: string }[] = [];
      const app = await createAppLoose({
        topology: topology(deployables),
        routes: hosted,
        ctx: createCtx({ mode: "sim", seed: SEED }),
        mode: "production",
        secret: "conformance-secret-mount-0123456789abcdef0123456789abcdef",
        deployable: "api",
        identity: identity({
          identify: async () => "",
          handle: {
            path: mount.path,
            fn: async (request) => {
              const url = new URL(request.url);
              seenByFn.push({
                method: request.method,
                path: url.pathname,
                search: url.search,
                body: await request.text(),
              });
              return new Response(null, { status: 303, headers: { location: "/" } });
            },
          },
        }),
      });
      const entries = [...(await renderedPost(VALID))];
      const link = await open("mt.home");
      await link.fire("mt.home.github", { type: "click" });
      entries.push(...link.documents());
      link.dispose();
      expect(entries).toHaveLength(2);
      for (const entry of entries) {
        const res = await app.fetch(
          new Request(`${BASE}${entry.url}`, {
            method: entry.method,
            ...(entry.body === null ? {} : { body: entry.body }),
            headers: { "sec-fetch-site": "same-origin", ...(entry.body === null ? {} : { "content-type": FORM }) },
          }),
        );
        expect(res.status).toBe(303);
      }
      expect(seenByFn).toEqual([
        { method: "POST", path: "/api/auth/sign-in/email", search: "", body: "email=a%40b.example&password=pw" },
        { method: "GET", path: "/api/auth/login/github", search: "?next=a%20b", body: "" },
      ]);
    });
  }
});
