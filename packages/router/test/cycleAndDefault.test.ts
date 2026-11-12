// @vitest-environment happy-dom
// Examples: the import cycle between routes.ts and an action file that imports it (E1505 names the fix), and the
// client default alert for keel.notFound matching the server's markup (k.head).
import { expect, it } from "vitest";
import { defaultError } from "../src/internal/defaultError.ts";

it("E1505 hints import routes.ts first when an action file that imports routes.ts loads first", async () => {
  const first = await import("./cycle/save.server.ts").then(
    () => "",
    (e: unknown) => (e instanceof Error ? e.message : "other"),
  );
  expect(first).toContain("(import routes.ts first)");
  expect(first).toContain("cyc.page: POST action lacks kind");
});

it("the default alert for keel.notFound is <h1>Not found</h1>; other codes print their message", () => {
  const nf = defaultError({ code: "keel.notFound", message: "keel.notFound", data: { url: "/x" } });
  expect(nf instanceof HTMLElement && nf.outerHTML).toBe(
    '<div role="alert" data-keel-error="keel.notFound"><h1>Not found</h1></div>',
  );
  const other = defaultError({ code: "keel.denied", message: "<b>no</b>", data: null });
  expect(other instanceof HTMLElement && other.outerHTML).toBe(
    '<div role="alert" data-keel-error="keel.denied">&lt;b&gt;no&lt;/b&gt;</div>',
  );
});
