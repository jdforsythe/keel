// @vitest-environment happy-dom
// k.opening Testing, k.links Testing: under `renderRoute(id, { shell: true })` a `fire` of `click`, `submit` or a `keydown` other than
// Escape is a person's act, marked on the render's ctx before it dispatches; no other `fire` is, and a render that is
// no shell marks nothing. Seed 1337 for the property.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { personActs } from "@keel/router/internal";
import fc from "fast-check";
import { afterEach, expect, it } from "vitest";
import { renderRoute } from "../src/renderRoute.ts";
import type { TestEvent } from "../src/types/TestEvent.ts";

const routes = manifest({
  "f.home": {
    path: "/",
    component: () => {
      const main = document.createElement("main");
      const field = document.createElement("input");
      field.id = "f.field";
      field.setAttribute("aria-label", "Note");
      main.append(field);
      return main;
    },
  },
});

const event: fc.Arbitrary<TestEvent> = fc.oneof(
  fc.constant<TestEvent>({ type: "click" }),
  fc.constant<TestEvent>({ type: "submit" }),
  fc.constant<TestEvent>({ type: "change" }),
  fc.constant<TestEvent>({ type: "focus" }),
  fc.constant<TestEvent>({ type: "blur" }),
  fc.string({ maxLength: 3 }).map((value): TestEvent => ({ type: "input", value })),
  fc.constantFrom("Escape", "a", "Enter", " ", "Tab").map((key): TestEvent => ({ type: "keydown", key })),
);
const expected = (e: TestEvent): boolean =>
  e.type === "click" || e.type === "submit" || (e.type === "keydown" && e.key !== "Escape");

const handles: { dispose(): void }[] = [];
afterEach(() => {
  for (const h of handles.splice(0)) h.dispose();
});

it("personActs.fired marks an act for click, submit and a non-Escape keydown only", () => {
  fc.assert(
    fc.property(event, (e) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      personActs.fired(ctx, e);
      expect(personActs.of(ctx).acted).toBe(expected(e));
    }),
    { seed: 1337, numRuns: 100 },
  );
});

it("a shell render's fire marks the ctx's act exactly for those events; the handle's navigate and settle never do", async () => {
  await fc.assert(
    // A blur needs focus first: it is fired after a focus, which is no act either.
    fc.asyncProperty(event, fc.boolean(), async (e, shell) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      const h = shell
        ? await renderRoute("f.home", { routes, ctx, shell: true })
        : await renderRoute("f.home", { routes, ctx });
      handles.push(h);
      await h.settle();
      await h.navigate(routes.href("f.home"));
      expect(personActs.of(ctx).acted).toBe(false);
      if (e.type === "blur") await h.fire("f.field", { type: "focus" });
      await h.fire("f.field", e);
      expect(personActs.of(ctx).acted).toBe(shell && expected(e));
      h.dispose();
    }),
    { seed: 1337, numRuns: 40 },
  );
});

it("a shell render reports a launch with no link before the first render; with launch 'later' the handle's launch reports once", async () => {
  // Nothing is held here, so no report stores an opening; a later report changes nothing, and without a shell
  // `launch` does nothing.
  for (const options of [{ shell: true }, { shell: true, launch: "later" }, {}] as const) {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const h = await renderRoute("f.home", { routes, ctx, ...options });
    await h.launch([]);
    await h.launch(null);
    expect(await ctx.storage.get("keel.return")).toBeNull();
    h.dispose();
  }
});
