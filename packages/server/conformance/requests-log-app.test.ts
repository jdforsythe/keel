// @vitest-environment happy-dom
// Spec: k.requests (rfc:0209), Conformance "`renderRoute(id, { routes, app, ctx })` of a page whose loader fetches `https://peer.example.com/x` through its own ctx, with a `Form` its action answers `ok(href)`: after the page is ready `requests()` is one entry, `GET` of the page's URL (`new URL(path, location.href).href`, `path` the page's href) with headers `['accept', 'sec-fetch-site']`; after a valid submit it is three, that GET, a `POST` to the form's action whose headers hold `content-type`, then a `GET` of `href`; each of the last two lists `cookie` exactly when an earlier answer of `app` set a cookie that is still in the jar; no entry's `url` is `https://peer.example.com/x`."
// Spec: k.requests (rfc:0209), Whose requests "With `app` or `shell` the page runs on a ctx of its own (k.mount Testing), and its request log holds every request of that browser ... a request `app` itself makes on `ctx` is not the page's."
// Seed 1337 (fc.assert below). Fixture shape follows render-route-document-support.ts: a TSX page with a `<Form>` over `form(Input)`, a submit is `fire` input then click.
// ASSUMPTIONS: "the page's URL" is `new URL('/q', location.href).href` (the clause names no origin; k.guards uses `location.href` the same way). A cookie is "still in the jar" when an earlier answer set one: the app's answers are recorded here and none removes a cookie.
import { type Ctx, createCtx } from "@keel/ctx";
import * as forms from "@keel/forms";
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import * as schema from "@keel/schema";
import { topology } from "@keel/server";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { MODULES, compilePage } from "./claim-support.ts";
import { createApp } from "./fixtures.ts";

const SEED = 1337;
const PEER = "https://peer.example.com/x";
const Amount = s.object({ amount: s.string({ min: 1 }) });
const Empty = s.object({});
const qc = contract("q", { "q.page": { path: "/q" }, "q.done": { path: "/qdone" } });

const PAGE = `import * as forms from "@keel/forms";
import { Form } from "@keel/router";
import { s } from "@keel/schema";
import { Input } from "@keel/ui";
const Amount = s.object({ amount: s.string({ min: 1 }) });
export default function Page() {
  const f = forms.form(Amount);
  return <div id="q.root">
    <Form method="POST" action="/q" form={f}>
      <Input id="q.amount" field={f.field("amount")} label="Amount" />
      <button id="q.save" type="submit">save</button>
    </Form>
  </div>
}
`;
const page = compilePage("q.page", PAGE, { ...MODULES, "@keel/forms": forms, "@keel/schema": schema });

const peerCalls = { n: 0 };
const peerCall = async (ctx: Ctx) => {
  await ctx.net.fetch(new Request(PEER));
  return ok({});
};
const routes = manifest(qc, {
  "q.page": {
    component: page,
    loader: loader(qc, "q.page", { output: Empty }, async (_input, ctx) => peerCall(ctx)),
    POST: action(qc, "q.page", { input: Amount }, async () => ok(qc.href("q.done"))),
  },
  "q.done": {
    component: () => Object.assign(document.createElement("p"), { id: "q.doneText" }),
    loader: loader(qc, "q.done", { output: Empty }, async (_input, ctx) => peerCall(ctx)),
  },
});

/** An app for the `node` deployable serving `q` on `ctx`; it records whether each answer set a cookie. */
async function appOn(ctx: Ctx) {
  const inner = await createApp({
    topology: topology({ web: { modules: ["q"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
  });
  const answered: { setCookie: boolean }[] = [];
  return {
    answered,
    fetch: async (req: Request): Promise<Response> => {
      const res = await inner.fetch(req);
      answered.push({ setCookie: res.headers.getSetCookie().length > 0 });
      return res;
    },
  };
}

const origin = (path: string): string => new URL(path, location.href).href;

describe("k.requests: the log of an `app` page is its browser's own", () => {
  test("with `app`, after the page is ready requests() is one GET of the page's URL with ['accept', 'sec-fetch-site']; after a valid submit it is that GET, a POST holding content-type, a GET of href; the last two list cookie exactly when an earlier answer set one; none is the peer", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{1,8}$/), async (value) => {
        const ctx = createCtx({ mode: "sim", seed: SEED });
        peerCalls.n = 0;
        ctx.net.route(PEER, () => {
          peerCalls.n++;
          return new Response("{}");
        });
        const app = await appOn(ctx);
        const opts = { routes, ctx, app };
        const h = await renderRoute("q.page", opts);
        await h.settle();
        expect(h.requests()).toEqual([{ method: "GET", url: origin("/q"), headers: ["accept", "sec-fetch-site"] }]);
        const afterLoad = h.requests();
        const firstSet = app.answered.some((a) => a.setCookie);
        await h.fire("q.amount", { type: "input", value });
        await h.fire("q.save", { type: "click" });
        await h.settle();
        const log = h.requests();
        expect(log).toHaveLength(3);
        expect(log.slice(0, 1)).toEqual(afterLoad);
        const [, post, next] = log;
        expect(post?.method).toBe("POST");
        expect(post?.url).toBe(origin("/q"));
        expect(post?.headers).toContain("content-type");
        expect(next?.method).toBe("GET");
        expect(next?.url).toBe(origin(qc.href("q.done")));
        expect(post?.headers.includes("cookie")).toBe(firstSet);
        const setBeforeNext = app.answered.slice(0, 2).some((a) => a.setCookie);
        expect(next?.headers.includes("cookie")).toBe(setBeforeNext);
        for (const e of log) expect(e.url).not.toBe(PEER);
        expect(peerCalls.n).toBeGreaterThan(0);
        h.dispose();
      }),
      { seed: SEED, numRuns: 5 },
    );
  });
});
