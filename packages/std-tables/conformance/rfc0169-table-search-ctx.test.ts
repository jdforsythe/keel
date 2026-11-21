// Spec: k.parity, clause "`TableSearch` rendered with no `ctx` never navigates; rendered in one of two mounted routers, it navigates that one, through the public `navigate`."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumption: `TableSearch(props, undefined, ctx)` is the component's call shape (its public signature); a route component built by hand passes the ctx itself.
// "Through the public `navigate`" is not observable apart from its effect: the router that encloses the caller moves, the other does not.
import { type Ctx, createCtx } from "@keel/ctx";
import { type RouterHistory, createRouter, manifest } from "@keel/router";
import { mount } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import { TableSearch } from "@keel/std-tables";
import { Box } from "@keel/ui";
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";
import { SEED, Search, findHref, queryOf } from "./fixtures.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};

/** A history over one URL, so a router needs no browser location. */
const memoryHistory = (start: string): RouterHistory => {
  let url = start;
  return {
    current: () => url,
    push: (u) => {
      url = u;
    },
    replace: (u) => {
      url = u;
    },
    onPop: () => () => {},
  };
};

const pageOf = (id: string, ctx: Ctx | undefined, withSearch: boolean) =>
  manifest({
    "tbl.find": {
      path: "/find",
      params: s.object({}),
      search: Search,
      component: (props) =>
        Box({
          id: `${id}.page`,
          children: () =>
            withSearch
              ? [
                  TableSearch(
                    {
                      id,
                      label: "Search",
                      get search() {
                        return queryOf(props.search);
                      },
                      href: findHref,
                    },
                    undefined,
                    ctx,
                  ),
                ]
              : [],
        }),
    },
  });

const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const h of hosts.splice(0)) h.remove();
});

function mountRouter(id: string, ctx: Ctx, withSearch: boolean, passCtx: boolean) {
  const router = createRouter(pageOf(id, passCtx ? ctx : undefined, withSearch), {
    ctx,
    history: memoryHistory("/find"),
  });
  const host = document.createElement("div");
  document.body.append(host);
  hosts.push(host);
  const unmount = mount(router.App, host);
  return { router, unmount };
}

const type = (id: string, value: string): void => {
  const found = document.getElementById(`${id}.input`);
  const input = found instanceof HTMLInputElement ? found : found?.querySelector("input");
  if (!input) throw new Error(`fixture: no input ${id}.input`);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("rfc:0169 conformance: TableSearch takes its clock from ctx only", () => {
  test("rfc:0169 conformance: `TableSearch` rendered with no `ctx` never navigates", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{1,6}$/), fc.integer({ min: 0, max: 100_000 }), async (q, ms) => {
        const ctx = createCtx({ mode: "sim", seed: SEED });
        const { router, unmount } = mountRouter("solo", ctx, true, false);
        await settle();
        type("solo", q);
        ctx.clock.advance(ms + 1000);
        await settle();
        expect(router.route.get()).toMatchObject({ id: "tbl.find", search: {} });
        unmount();
        router.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("rfc:0169 conformance: rendered in one of two mounted routers, it navigates that one, through the public `navigate`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), fc.stringMatching(/^[a-z]{1,6}$/), async (inFirst, q) => {
        const ctxA = createCtx({ mode: "sim", seed: SEED });
        const ctxB = createCtx({ mode: "sim", seed: SEED });
        const a = mountRouter("a", ctxA, inFirst, true);
        const b = mountRouter("b", ctxB, !inFirst, true);
        await settle();
        const [own, other, ownCtx, otherCtx] = inFirst ? [a, b, ctxA, ctxB] : [b, a, ctxB, ctxA];
        type(inFirst ? "a" : "b", q);
        ownCtx.clock.advance(300);
        otherCtx.clock.advance(300);
        await settle();
        expect(own.router.route.get()).toMatchObject({ id: "tbl.find", search: { q } });
        expect(other.router.route.get()).toMatchObject({ id: "tbl.find", search: {} });
        expect(Reflect.get(other.router.route.get().search, "q")).toBeUndefined();
        for (const r of [a, b]) {
          r.unmount();
          r.router.dispose();
        }
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
