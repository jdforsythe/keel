// Spec: k.router, Conformance "Of two navigations started before either settles, the later one's page shows in either settle order."
// Seed: 1337.
// @vitest-environment happy-dom
// ASSUMPTIONS (as in fixtures.ts): createRouter(routes, { ctx, history }) returns { App, navigate, route, dispose }; `navigate` returns a promise
// that settles when that navigation does. Loaders wait on deferred promises this file resolves by hand. Skipped until the router drops a superseded navigation.
import { createCtx } from "@keel/ctx";
import { createRouter, loader, manifest } from "@keel/router";
import type { RouteProps } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { text } from "@keel/runtime-dom/ops";
import { ok, s } from "@keel/schema";
import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { SEED, defer, memoryHistory, settle } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const Search = s.object({ q: s.string({ min: 1, max: 4 }).optional() });
const Empty = s.object({});

// One deferred per (route id, q); a loader with no deferred set for its key finishes at once.
const gates = new Map<string, Promise<void>>();
const key = (id: string, q: string | undefined): string => `${id}?${q ?? ""}`;
const slow = <I extends "w.a" | "w.b">(id: I) =>
  loader(wContract, id, { output: Empty }, async () => {
    await gates.get(key(id, undefined));
    return ok({});
  });
const wContract = contract("w", {
  "w.a": { path: "/w/a" },
  "w.b": { path: "/w/b" },
  "w.s": { path: "/w/s", search: Search },
});
const loadSearch = loader(wContract, "w.s", { output: Empty }, async ({ search }) => {
  await gates.get(key("w.s", search.q));
  return ok({});
});

const mark = (id: string) => (): Node => {
  const section = document.createElement("section");
  section.setAttribute("data-page", id);
  section.textContent = id;
  return section;
};
const SearchPage = (props: RouteProps): Node => {
  const section = document.createElement("section");
  section.setAttribute("data-page", "w.s");
  const shown = document.createElement("p");
  shown.setAttribute("data-q", "");
  text(shown, () => {
    const q: unknown =
      typeof props.search === "object" && props.search !== null ? Reflect.get(props.search, "q") : undefined;
    return typeof q === "string" ? q : "";
  });
  section.append(shown);
  return section;
};

const routes = manifest(wContract, {
  "w.a": { component: mark("w.a"), loader: slow("w.a") },
  "w.b": { component: mark("w.b"), loader: slow("w.b") },
  "w.s": { component: SearchPage, loader: loadSearch },
});

type Target = { id: "w.a" | "w.b" | "w.s"; q: string | undefined };
const targets: readonly Target[] = [
  { id: "w.a", q: undefined },
  { id: "w.b", q: undefined },
  { id: "w.s", q: "x" },
  { id: "w.s", q: "y" },
];
const hrefOf = (t: Target) =>
  t.id === "w.s" ? wContract.href("w.s", {}, t.q === undefined ? {} : { q: t.q }) : wContract.href(t.id);

afterEach(() => {
  gates.clear();
  document.body.replaceChildren();
});

describe("k.router: the last navigation started wins", () => {
  it("Of two navigations started before either settles, the later one's page shows in either settle order", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...targets),
        fc.constantFrom(...targets),
        fc.boolean(),
        fc.constantFrom<Target>({ id: "w.s", q: "z" }, { id: "w.s", q: undefined }),
        async (first, later, laterSettlesFirst, rendered) => {
          fc.pre(key(first.id, first.q) !== key(later.id, later.q));
          const router = createRouter(routes, {
            ctx: createCtx({ mode: "sim", seed: SEED }),
            history: memoryHistory(String(hrefOf(rendered))),
          });
          const host = document.createElement("div");
          document.body.append(host);
          const unmount = mount(router.App, host, { ctx: simCtx });
          await settle();
          const gateFirst = defer();
          const gateLater = defer();
          gates.set(key(first.id, first.q), gateFirst.promise);
          gates.set(key(later.id, later.q), gateLater.promise);
          const navFirst = router.navigate(hrefOf(first));
          const navLater = router.navigate(hrefOf(later));
          await settle();
          expect(router.route.get().pending).toBe(true);
          const order = laterSettlesFirst ? [gateLater, gateFirst] : [gateFirst, gateLater];
          for (const gate of order) {
            gate.resolve();
            await settle();
          }
          await Promise.all([navFirst, navLater]);
          await settle();
          expect(router.route.get()).toMatchObject({ id: later.id, pending: false });
          const pages = [...host.querySelectorAll("[data-page]")];
          expect(pages.map((p) => p.getAttribute("data-page"))).toEqual([later.id]);
          if (later.id === "w.s") expect(host.querySelector("[data-q]")?.textContent).toBe(later.q ?? "");
          unmount();
          router.dispose();
          host.remove();
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });
});
