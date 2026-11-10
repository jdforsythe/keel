// Property (k.prefix): `routes.href` then match is the identity, with and without `pathDefault`. Seed 1337.
import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { manifest } from "../src/manifest.ts";
import { matchHref } from "../src/match/index.ts";

const opts = { seed: 1337, numRuns: 100 };
const view = (): Node => document.createComment("");
const values = ["en-US", "de-DE", "ja-JP"] as const;
const Item = s.string({ min: 1, max: 12 });
const Q = s.object({ q: s.string({ min: 1 }).optional() });

const tableFor = (pathDefault: boolean) => {
  const L = pathDefault ? s.enum(values, { pathDefault: "en-US" }) : s.enum(values);
  const Show = s.object({ p: L, id: Item });
  const Home = s.object({ p: L });
  return {
    Show,
    Home,
    routes: manifest({
      "x.show": { path: "/:p/items/:id", params: Show, search: Q, component: view },
      "x.home": { path: "/:p", params: Home, component: view },
      "x.list": { path: "/:p/items", params: Home, component: view },
    }),
  };
};

describe("k.prefix href then match", () => {
  for (const pathDefault of [true, false])
    it(`is the identity ${pathDefault ? "with" : "without"} pathDefault`, () => {
      const { Show, Home, routes } = tableFor(pathDefault);
      fc.assert(
        fc.property(gen(Show), gen(Q), gen(Home), (p, q, h) => {
          expect(matchHref(routes, routes.href("x.show", p, q))).toEqual({ id: "x.show", params: p, search: q });
          expect(matchHref(routes, routes.href("x.home", h))).toEqual({ id: "x.home", params: h, search: {} });
          expect(matchHref(routes, routes.href("x.list", h))).toEqual({ id: "x.list", params: h, search: {} });
          const href = String(routes.href("x.show", p));
          expect(href.startsWith(`/${p.p}/`)).toBe(!pathDefault || p.p !== "en-US");
        }),
        opts,
      );
    });
});
