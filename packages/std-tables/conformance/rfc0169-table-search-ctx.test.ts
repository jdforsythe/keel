// Spec: k.parity, clause "`TableSearch` rendered in one of two mounted routers navigates that one, through the public `navigate`."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumption: `TableSearch(props, ctx)` is the component's call shape (its public signature, rfc:0162); a route component built by hand passes the ctx itself.
// "Through the public `navigate`" is not observable apart from its effect: the router that encloses the caller moves, the other does not.
import { type Ctx, createCtx } from "@keel/ctx";
import { type RouterHistory, createRouter, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
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

const tbl = contract("tbl", { "tbl.find": { path: "/find", params: s.object({}), search: Search } });

const pageOf = (id: string, ctx: Ctx, withSearch: boolean) =>
  manifest(tbl, {
    "tbl.find": {
      component: (props) =>
        Box({
          id: `${id}.page`,
          children: () => {
            if (!withSearch) return [];
            const searchProps = {
              id,
              label: "Search",
              get search() {
                return queryOf(props.search);
              },
              href: findHref,
            };
            return [TableSearch(searchProps, ctx)];
          },
        }),
    },
  });

const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const h of hosts.splice(0)) h.remove();
});

function mountRouter(id: string, ctx: Ctx, withSearch: boolean) {
  const router = createRouter(pageOf(id, ctx, withSearch), {
    ctx,
    history: memoryHistory("/find"),
  });
  const host = document.createElement("div");
  document.body.append(host);
  hosts.push(host);
  const unmount = mount(router.App, host, { ctx });
  return { router, unmount };
}

const type = (id: string, value: string): void => {
  const found = document.getElementById(`${id}.input`);
  const input = found instanceof HTMLInputElement ? found : found?.querySelector("input");
  if (!input) throw new Error(`fixture: no input ${id}.input`);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("rfc:0169 conformance: TableSearch navigates the router that encloses it", () => {
  test("rfc:0169 conformance: rendered in one of two mounted routers, it navigates that one, through the public `navigate`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), fc.stringMatching(/^[a-z]{1,6}$/), async (inFirst, q) => {
        const ctxA = createCtx({ mode: "sim", seed: SEED });
        const ctxB = createCtx({ mode: "sim", seed: SEED });
        const a = mountRouter("a", ctxA, inFirst);
        const b = mountRouter("b", ctxB, !inFirst);
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
