// @vitest-environment happy-dom
// k.head, Title "The document's title is the matched route's `title`. Without one, when a loader in the chain returns `err`, and for a 404, it is the fallback: the served deployable's name: a server's, which its document's `#k-state` carries as `title` (k.runtime), and a `client` deployable's `index.html` title. The client router reads it once as it starts: `#k-state`'s `title`, else `document.title`."
// Spec: k.head, clause "After `resume` of a document served by `node` deployable `api` for a route whose `title` returns `Notes`, over any sequence of client navigations to that route, to a route without `title` and to a route whose loader returns `err`, `document.title` is `Notes` on the titled route and `api` on each other."
// Seed 1337 (fc.assert below). The served document is real `createApp` output (so this lives in packages/server/conformance: @keel/testing does not depend on @keel/server); the client side is the public `resume` (`@keel/runtime-dom/ops`) over the served body, then `createRouter(routes, { ctx, history: browserHistory() })` and its `navigate`, as head-resume.test.ts copies the served head and resumes the body.
// ASSUMPTIONS: "after `resume` of a served document" is the served `<title>` and `lang` copied into the test document, its body (the `#k-state` script kept, the module scripts removed) set and resumed, and a router then started on that document at the served URL; the fallback reaches the router through the document (the RFC's `#k-state`), nothing else is passed to `createRouter`.
// The page `/notes` holds an island (a button with a handler) so the served document carries a `#k-state`.
import { createCtx } from "@keel/ctx";
import { browserHistory, createRouter, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { resume } from "@keel/runtime-dom/ops";
import { err, ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { Box, Button } from "@keel/ui";
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";

const SEED = 1337;
const ctx = createCtx({ mode: "sim", seed: SEED });
const Empty = s.object({});
const Broken = s.error("h.broken", s.object({}));
const island = (): Node => Box({ children: () => Button({ id: "h.go", onClick: () => undefined, children: "Go" }) });
const plain = (): Node => document.createElement("p");
const hc = contract("h", {
  "h.notes": { path: "/notes" },
  "h.plain": { path: "/plain" },
  "h.broken": { path: "/broken" },
});
const routes = manifest(hc, {
  "h.notes": { component: island, title: () => "Notes" },
  "h.plain": { component: plain },
  "h.broken": {
    component: plain,
    loader: loader(hc, "h.broken", { output: Empty }, async () => err(Broken.make({}))),
    title: () => "Never shown",
  },
});
const ID = { notes: "h.notes", plain: "h.plain", broken: "h.broken" } as const;
const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};

afterEach(() => {
  document.body.innerHTML = "";
  document.title = "";
});

describe("k.head: the fallback title after resume", () => {
  test("after resume of a document served by node deployable api for a route whose title returns Notes, over any sequence of client navigations to that route, to a route without title and to a route whose loader returns err, document.title is Notes on the titled route and api on each other", async () => {
    const app = await createApp({
      topology: topology({ api: { modules: ["h"], adapter: "node" } }),
      routes,
      ctx,
      mode: "production",
    });
    const res = await app.fetch(new Request("http://localhost/notes"));
    expect(res.status).toBe(200);
    const served = new DOMParser().parseFromString(await res.text(), "text/html");
    for (const sc of served.body.querySelectorAll("script[type=module]")) sc.remove();
    expect(served.title).toBe("Notes");
    const route = fc.constantFrom<"notes" | "plain" | "broken">("notes", "plain", "broken");
    await fc.assert(
      fc.asyncProperty(fc.array(route, { minLength: 1, maxLength: 6 }), async (visits) => {
        window.history.replaceState({}, "", "/notes");
        document.title = served.title;
        document.documentElement.lang = served.documentElement.getAttribute("lang") ?? "";
        document.body.innerHTML = served.body.innerHTML;
        resume(document.body, { "h.notes": island }, { ctx });
        const router = createRouter(routes, { ctx, history: browserHistory() });
        await settle();
        expect(document.title).toBe("Notes");
        for (const visit of visits) {
          await router.navigate(hc.href(ID[visit]));
          await settle();
          expect(document.title, `after ${visit}`).toBe(visit === "notes" ? "Notes" : "api");
        }
        router.dispose();
      }),
      { seed: SEED, numRuns: 15 },
    );
  });
});
