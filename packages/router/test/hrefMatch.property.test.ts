// Properties for href and matching over generated manifests (k.router Links, Matching). Seed 1337.
import { createCtx } from "@keel/ctx";
import { type ObjectSchema, type Schema, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createRouter } from "../src/createRouter.ts";
import { href } from "../src/href.ts";
import { manifest } from "../src/manifest.ts";
import type { RouteDef } from "../src/types/RouteDef.ts";
import { memoryHistory } from "./memoryHistory.ts";

const opts = { seed: 1337, numRuns: 60 };
const ctx = createCtx({ mode: "sim", seed: 1337 });
const view = (): Node => document.createComment("");
let run = 0;

type Kind = "int" | "id" | "enum";
type SegSpec = { readonly param: Kind | null; readonly word: string };
const leaf = (k: Kind): Schema<unknown> =>
  k === "int" ? s.int() : k === "id" ? s.id("T") : s.enum(["a", "b c", "d/e"]);
const word = fc.stringMatching(/^[a-z]{1,5}$/);
const seg = fc.record({ param: fc.constantFrom<Kind | null>(null, "int", "id", "enum"), word });
const routeSpec = fc.record({ segs: fc.array(seg, { maxLength: 3 }), search: fc.subarray(["n", "t", "e", "f"]) });

const searchField = (k: string): Schema<unknown, true> =>
  k === "n"
    ? s.int().optional()
    : k === "t"
      ? s.string({ min: 1 }).optional()
      : k === "e"
        ? s.enum(["x", "y z"]).optional()
        : s.boolean().optional();

type Built = { id: string; def: RouteDef; params?: ObjectSchema<unknown>; search?: ObjectSchema<unknown> };
function build(i: number, spec: { segs: readonly SegSpec[]; search: readonly string[] }): Built {
  const shape: Record<string, Schema<unknown>> = {};
  const parts = [`r${run}x${i}`];
  spec.segs.forEach((g, j) => {
    if (g.param === null) parts.push(g.word);
    else {
      shape[`p${j}`] = leaf(g.param);
      parts.push(`:p${j}`);
    }
  });
  const params = Object.keys(shape).length === 0 ? undefined : s.object(shape);
  const search =
    spec.search.length === 0 ? undefined : s.object(Object.fromEntries(spec.search.map((k) => [k, searchField(k)])));
  const def: RouteDef = {
    path: `/${parts.join("/")}`,
    component: view,
    ...(params === undefined ? {} : { params }),
    ...(search === undefined ? {} : { search }),
  };
  return {
    id: `m${run}.r${i}`,
    def,
    ...(params === undefined ? {} : { params }),
    ...(search === undefined ? {} : { search }),
  };
}

const rec = (v: unknown): Readonly<Record<string, unknown>> =>
  typeof v === "object" && v !== null ? Object.fromEntries(Object.entries(v)) : {};
const withValues = (b: Built) =>
  fc
    .tuple(b.params ? gen(b.params) : fc.constant({}), b.search ? gen(b.search) : fc.constant({}))
    .map(([p, q]) => ({ b, p: rec(p), q: rec(q) }));

describe("href and matching over generated manifests", () => {
  it("navigate(href(id, p, q)) makes route() equal { id, params: p, search: q, pending: false }", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(routeSpec, { minLength: 1, maxLength: 4 }).chain((specs) => {
          run += 1;
          const built = specs.map((spec, i) => build(i, spec));
          return fc.tuple(fc.constant(built), fc.constantFrom(...built).chain(withValues));
        }),
        async ([built, { b, p, q }]) => {
          const routes = manifest(Object.fromEntries(built.map((x) => [x.id, x.def])));
          const history = memoryHistory("/nowhere");
          const router = createRouter(routes, { ctx, history });
          const to = href(b.id, p, q);
          expect(href(b.id, p, q)).toBe(to);
          await router.navigate(to);
          expect(router.route.get()).toEqual({ id: b.id, params: p, search: q, pending: false });
          expect(history.current()).toBe(to);
          router.dispose();
        },
      ),
      opts,
    );
  });

  it("a static segment beats :param regardless of declaration order", async () => {
    await fc.assert(
      fc.asyncProperty(word, word, fc.boolean(), async (w, u, staticFirst) => {
        fc.pre(w !== u);
        run += 1;
        const stat: [string, RouteDef] = [`s${run}.static`, { path: `/s${run}/${w}`, component: view }];
        const param: [string, RouteDef] = [
          `s${run}.param`,
          { path: `/s${run}/:x`, params: s.object({ x: s.string({ min: 1 }) }), component: view },
        ];
        const routes = manifest(Object.fromEntries(staticFirst ? [stat, param] : [param, stat]));
        const router = createRouter(routes, { ctx, history: memoryHistory("/nowhere") });
        await router.navigate(href(param[0], { x: w }));
        expect(router.route.get().id).toBe(stat[0]);
        await router.navigate(href(param[0], { x: u }));
        expect(router.route.get()).toMatchObject({ id: param[0], params: { x: u } });
        router.dispose();
      }),
      opts,
    );
  });

  it("a trailing slash matches the same route and is replaced by the canonical path", async () => {
    await fc.assert(
      fc.asyncProperty(word, fc.integer({ min: 1, max: 3 }), async (w, slashes) => {
        run += 1;
        const id = `t${run}.page`;
        const routes = manifest({ [id]: { path: `/t${run}/${w}`, component: view } });
        const history = memoryHistory("/nowhere");
        const router = createRouter(routes, { ctx, history });
        history.pop(`/t${run}/${w}${"/".repeat(slashes)}`);
        await Promise.resolve();
        expect(router.route.get()).toMatchObject({ id });
        expect(history.current()).toBe(`/t${run}/${w}`);
        router.dispose();
      }),
      opts,
    );
  });
});
