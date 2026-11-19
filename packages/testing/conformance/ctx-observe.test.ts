// @vitest-environment happy-dom
// Spec: k.ctx, clause "Under a sim ctx, a navigation, a `fire`, a resource state and a `Boundary` catch each reach `observe` once, in order; a password field's `input` value arrives as `x` repeated, also after its `type` changes; an observer added after a navigation gets it first, one that throws stops no other, and none gets an event after its stop function runs." (rfc:0070)
// Seed 1337. In @keel/testing because it needs the router, runtime-dom and the route harness.
import { observe } from "@keel/ctx";
import type { CtxEvent } from "@keel/ctx";
import { inspect, resource, signal } from "@keel/reactive";
import { manifest } from "@keel/router";
import { boundary, clone, match, on, template, text } from "@keel/runtime-dom/ops";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";

const PAGE = template(
  '<main id="ob.main"><button id="ob.go">go</button><label for="ob.pw">Password</label><input id="ob.pw" type="password"><button id="ob.show" type="button">show</button><div id="ob.res"><!----></div><div id="ob.box"><!----></div></main>',
);
const SHOWN = template('<p id="ob.shown"></p>');
const BOOM = template('<button id="ob.boom">boom</button>');
const FELL = template('<p id="ob.fell">fell</p>');

const hops = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};
const last = (el: Element | null): Node => {
  const a = el?.lastChild ?? null;
  if (a === null) throw new Error("fixture: no anchor");
  return a;
};

const routes = manifest({
  "ob.home": {
    path: "/ob",
    component: () => {
      const root = clone(PAGE);
      if (!(root instanceof Element)) throw new Error("fixture: no root");
      const want = signal(0);
      const res = resource(async () => {
        const n = want.get();
        await hops(3);
        return n;
      });
      const shown = (label: string) => () => {
        const p = clone(SHOWN);
        text(p, () => label);
        return p;
      };
      match(last(root.querySelector("#ob\\.res")), () => res.get(), "state", {
        loading: shown("loading"),
        ready: shown("ready"),
        error: shown("error"),
      });
      boundary(
        last(root.querySelector("#ob\\.box")),
        () => {
          const b = clone(BOOM);
          on("ob.boom", "click", () => {
            throw new Error("boom");
          });
          return b;
        },
        () => clone(FELL),
      );
      on("ob.go", "click", () => want.set(want.get() + 1));
      on("ob.show", "click", () => root.querySelector("#ob\\.pw")?.setAttribute("type", "text"));
      return root;
    },
  },
  "ob.next": {
    path: "/ob/next",
    component: () => {
      const p = document.createElement("p");
      p.id = "ob.next";
      p.textContent = "next";
      return p;
    },
  },
});

type Step = { kind: "go" } | { kind: "show" } | { kind: "pw"; value: string };
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.constant<Step>({ kind: "go" }),
  fc.constant<Step>({ kind: "show" }),
  fc.string({ maxLength: 6 }).map((value): Step => ({ kind: "pw", value })),
);

const resourceIds = (): string[] =>
  inspect()
    .nodes.filter((n) => n.kind === "resource")
    .map((n) => String(n.id));
/** The event without its resource id (checked separately) and nav schemas (objects). */
const shape = (e: CtxEvent): unknown =>
  e.kind === "resource"
    ? { kind: e.kind, state: e.state }
    : e.kind === "nav"
      ? { kind: e.kind, href: e.href, id: e.route.id, path: e.route.path }
      : e.kind === "error"
        ? { kind: e.kind, code: e.error.code }
        : e;

test("each navigation, fire, resource state and Boundary catch reaches observe once, in order", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(stepArb, { maxLength: 5 }), fc.nat(8), async (steps, cut) => {
      const ctx = simCtx();
      const all: CtxEvent[] = [];
      const early: CtxEvent[] = [];
      const stopEarly = observe(ctx, (e) => early.push(e));
      observe(ctx, () => {
        throw new Error("observer throws");
      });
      observe(ctx, (e) => all.push(e));
      const h = await renderRoute("ob.home", { routes, ctx });
      const late: CtxEvent[] = [];
      observe(ctx, (e) => late.push(e));
      const expected: unknown[] = [
        { kind: "nav", href: "/ob", id: "ob.home", path: "/ob" },
        { kind: "resource", state: "loading" },
        { kind: "resource", state: "ready" },
      ];
      let stoppedAt = -1;
      for (const [i, step] of steps.entries()) {
        if (i === cut) {
          stopEarly();
          stoppedAt = early.length;
        }
        if (step.kind === "go") {
          await h.fire("ob.go", { type: "click" });
          expected.push(
            { kind: "fire", id: "ob.go", event: { type: "click" } },
            { kind: "resource", state: "loading" },
            { kind: "resource", state: "ready" },
          );
        } else if (step.kind === "show") {
          // A show-password toggle: the field's type becomes text, and its values stay masked.
          await h.fire("ob.show", { type: "click" });
          expected.push({ kind: "fire", id: "ob.show", event: { type: "click" } });
        } else {
          await h.fire("ob.pw", { type: "input", value: step.value });
          expected.push({ kind: "fire", id: "ob.pw", event: { type: "input", value: "x".repeat(step.value.length) } });
        }
      }
      await h.fire("ob.boom", { type: "click" });
      expected.push(
        { kind: "fire", id: "ob.boom", event: { type: "click" } },
        { kind: "error", code: "keel.unexpected" },
      );
      await h.navigate(routes.href("ob.next"));
      expected.push({ kind: "nav", href: "/ob/next", id: "ob.next", path: "/ob/next" });
      // Back to a page with a <main>: the router focuses it, which is kernel work and no `fire`.
      await h.navigate(routes.href("ob.home"));
      expected.push(
        { kind: "nav", href: "/ob", id: "ob.home", path: "/ob" },
        { kind: "resource", state: "loading" },
        { kind: "resource", state: "ready" },
      );
      h.dispose();

      expect(all.map(shape)).toEqual(expected);
      expect(late.map(shape)).toEqual([expected[0], ...expected.slice(3)]);
      expect(early.map(shape)).toEqual(stoppedAt < 0 ? expected : expected.slice(0, stoppedAt));
      const ids = new Set(all.flatMap((e) => (e.kind === "resource" ? [e.id] : [])));
      expect(ids.size).toBe(2);
      for (const e of all)
        if (e.kind === "fire" && e.id === "ob.pw" && e.event.type === "input") expect(e.event.value).toMatch(/^x*$/);
    }),
    { seed: SEED, numRuns: 15 },
  );
});

test("the resource id is the resource's inspect() node id while it is live", async () => {
  const ctx = simCtx();
  const got: string[] = [];
  let live: string[] = [];
  observe(ctx, (e) => {
    if (e.kind === "resource") {
      got.push(e.id);
      live = resourceIds();
    }
  });
  const h = await renderRoute("ob.home", { routes, ctx });
  expect(got.length).toBeGreaterThan(0);
  for (const id of got) expect(live).toContain(id);
  h.dispose();
});
