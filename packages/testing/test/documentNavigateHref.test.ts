// @vitest-environment happy-dom
// k.testing Harness, k.router: `navigate` of a `renderRoute` with `app` rejects with E1501 for a value that is no
// Href, as the harness without `app` does, and records nothing; an Href is still loaded.
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { renderRoute } from "@keel/testing";
import { expect, test } from "vitest";

const c = contract("dn", { "dn.page": { path: "/dn" } });
const routes = manifest(c, { "dn.page": { component: () => document.createElement("main") } });
const app = {
  fetch: async (): Promise<Response> =>
    new Response("<!doctype html><html lang=\"en\"><head><title>t</title></head><body><main><h1>t</h1></main></body></html>", {
      headers: { "content-type": "text/html" },
    }),
};

test("navigate with a value that is no Href rejects E1501 and records no document", async () => {
  const h = await renderRoute("dn.page", { routes, app });
  try {
    for (const bad of ["https://evil.example/x", "//evil.example/x", "dn", ""]) {
      const got = await h.navigate(bad as never).then(
        () => null,
        (e: unknown) => e,
      );
      expect(got).toMatchObject({ code: "E1501" });
    }
    expect(h.documents()).toEqual([]);
    expect(h.location().entries).toBe(1);
  } finally {
    h.dispose();
  }
});

test("navigate with an Href loads it and records it", async () => {
  const h = await renderRoute("dn.page", { routes, app });
  try {
    await h.navigate(c.href("dn.page"));
    expect(h.documents()).toHaveLength(1);
    expect(h.location().entries).toBe(2);
  } finally {
    h.dispose();
  }
});
