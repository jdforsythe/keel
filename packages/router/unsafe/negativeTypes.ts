// Type-only fixture (in unsafe/ because it needs expected-error directives): checked by tsc, never run. The run-time
// halves of these cases are asserted in test/actionOutput.types.test.ts, apiRoutes.test.ts, foreignLayout.dom.test.ts,
// manifest.test.ts, matching.test.ts and paramsInference.types.test.ts, which call the same APIs untyped.
import { ok, s } from "@keel/schema";
import { action } from "../src/action.ts";
import { contract } from "../src/contract/contract.ts";
import { guard } from "../src/guard.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";

export function negativeTypes(): void {
  const view = (): Node => document.createComment("");

  // actionOutput.types.test.ts
  const ao = contract("t", {
    "t.reports": { method: "POST", path: "/api/reports", output: s.object({ n: s.int() }) },
    "t.nothing": { method: "DELETE", path: "/api/nothing", output: s.object({}) },
    "t.index": { path: "/" },
  });
  // @ts-expect-error the entry's output is { n: number }, not a link
  action(ao, "t.reports", {}, async () => ok(ao.href("t.index")));
  // @ts-expect-error a page action answers a link or null
  action(ao, "t.index", { input: s.object({}) }, async () => ok({ n: 1 }));
  const pageAct = action(ao, "t.index", { input: s.object({}) }, async () => ok(null));
  const nothing = action(ao, "t.nothing", {}, async () => ok({}));
  manifest(ao, {
    // @ts-expect-error a page action bound at an API write entry
    "t.reports": { action: pageAct },
    "t.nothing": { action: nothing },
    "t.index": { component: view },
  });

  // apiRoutes.test.ts
  const Out = s.object({});
  const bare = guard({}, async () => ok(null));
  const gc = contract("t", {
    "t.l": { layout: true },
    "t.p": { path: "/p" },
    "t.a": { method: "GET", path: "/a", output: Out },
  });
  const get = loader(gc, "t.a", {}, async () => ok({}));
  manifest(gc, {
    "t.l": { component: view },
    // @ts-expect-error a page guard needs a redirect
    "t.p": { component: view, guard: bare },
    "t.a": { loader: get },
  });
  manifest(gc, {
    // @ts-expect-error a layout guard needs a redirect
    "t.l": { component: view, guard: bare },
    "t.p": { component: view },
    "t.a": { loader: get },
  });
  // @ts-expect-error an API entry has no page to link to
  gc.href("t.a");

  // foreignLayout.dom.test.ts
  const ap = contract("ap", { "ap.inner": { layout: true }, "ap.page": { path: "/ap" } });
  manifest(ap, {
    "ap.inner": { component: view },
    // @ts-expect-error a typo within the own module's prefix
    "ap.page": { component: view, layout: "ap.layuot" },
  });
  manifest(ap, {
    "ap.inner": { component: view },
    // @ts-expect-error an own page is no layout
    "ap.page": { component: view, layout: "ap.page" },
  });

  // manifest.test.ts
  // @ts-expect-error a layout is exactly { layout: true }
  contract("v12", { "v12.l": { layout: true, path: "/l" } });
  const v6 = contract("v6", { "v6.l": { path: "/v6l" }, "v6.a": { path: "/v6" } });
  manifest(v6, {
    "v6.l": { component: view },
    // @ts-expect-error v6.l is a page, not a layout
    "v6.a": { component: view, layout: "v6.l" },
  });
  const v8 = contract("v8", { "v8.a": { path: "/v8" } });
  manifest(v8, {
    // @ts-expect-error v8.shell is no entry of the contract
    "v8.a": { component: view, layout: "v8.shell" },
  });
  const v7 = contract("v7", { "v7.a": { path: "/v7" }, "v7.b": { path: "/v7b" } });
  // @ts-expect-error v7.b is not bound
  manifest(v7, { "v7.a": { component: view } });
  const v9 = contract("v9", { "v9.a": { path: "/v9" } });
  // @ts-expect-error v9.extra is no entry of the contract
  manifest(v9, { "v9.a": { component: view }, "v9.extra": { component: view } });
  const v10t = contract("v10t", { "v10t.l": { layout: true }, "v10t.a": { path: "/v10t" } });
  manifest(v10t, {
    // @ts-expect-error a layout binding takes no title
    "v10t.l": { component: view, title: () => "t" },
    "v10t.a": { component: view },
  });
  const v11 = contract("v11", { "v11.a": { path: "/v11" } });
  const save = action(v11, "v11.a", { input: s.object({}) }, async () => ok(null));
  manifest(v11, {
    // @ts-expect-error a page binding takes no `action`
    "v11.a": { component: view, action: save },
  });
  const v13 = contract("v13", { "v13.a": { path: "/v13" } });
  manifest(v13, {
    // @ts-expect-error a page guard names a redirect
    "v13.a": { component: view, guard: bare },
  });

  // matching.test.ts
  const ma = contract("a", { "a.x": { path: "/x" } });
  manifest(ma, {
    // @ts-expect-error a.missing is no layout of the contract
    "a.x": { component: view, layout: "a.missing" },
  });

  // paramsInference.types.test.ts
  const Plain = s.object({ n: s.int() });
  const t = contract("t", {
    "t.shell": { layout: true },
    "t.show": { path: "/t/:todoId", params: s.object({ todoId: s.id("Todo") }) },
    "t.plain": { path: "/plain" },
    "t.other": { path: "/other" },
  });
  const forOther = loader(t, "t.other", { output: Plain }, async () => ok({ n: 1 }));
  const saveShow = action(t, "t.show", { input: s.object({}) }, () => ok(null));
  manifest(t, {
    "t.shell": { component: view },
    // @ts-expect-error forOther was declared for t.other
    "t.show": { component: view, loader: forOther },
    "t.plain": { component: view },
    "t.other": { component: view },
  });
  manifest(t, {
    "t.shell": { component: view },
    "t.show": { component: view },
    "t.plain": { component: view },
    // @ts-expect-error saveShow was declared for t.show
    "t.other": { component: view, PUT: saveShow },
  });
}
