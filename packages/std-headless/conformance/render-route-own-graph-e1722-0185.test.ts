// @vitest-environment happy-dom
// k.testing, Rules "E1722 `renderRoute` given `app` with `state` or `shell`, or `routes` as an import without `app`".
// k.testing, Harness "With `routes: () => import(path)` the page resumes likewise (E1722 without `app`)".
// Seed: 1337 (no generated input). E1722 is the rejection's `code`, as E1720 is for `resumeDocument`.
import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import { expect, test } from "vitest";
import { SEED } from "./resume-support.ts";

const codeOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? Reflect.get(e, "code") : undefined);

test("`routes` as an import without `app` rejects E1722", async () => {
  const e = await renderRoute("og.page", {
    routes: () => import("./render-route-own-graph-routes.ts"),
    ctx: createCtx({ mode: "sim", seed: SEED }),
  }).then(
    () => undefined,
    (x: unknown) => x,
  );
  expect(codeOf(e)).toBe("E1722");
});
