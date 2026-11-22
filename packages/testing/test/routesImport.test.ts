// @vitest-environment happy-dom
// k.testing Harness: `routes` as an import resumes a `renderRoute` page with `app` in a client module graph of its
// own; without `app` (a router render in the test's graph) it rejects with E1722 before anything renders.
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { renderRoute } from "@keel/testing";
import { expect, test } from "vitest";

const c = contract("ri", { "ri.page": { path: "/ri" } });
const routes = manifest(c, { "ri.page": { component: () => document.createElement("main") } });

test("routes as an import without app rejects with E1722 and renders nothing", async () => {
  const before = document.body.childElementCount;
  const got = await renderRoute("ri.page", { routes: async () => ({ routes }) }).then(
    () => null,
    (e: unknown) => e,
  );
  expect(got).toMatchObject({ code: "E1722", data: { option: "routes" } });
  expect(document.body.childElementCount).toBe(before);
});
