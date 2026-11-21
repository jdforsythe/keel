// @vitest-environment happy-dom
// Examples: an action file and routes.ts share no import cycle through the contract, and the
// client default alert for keel.notFound matching the server's markup (k.head).
import { expect, it } from "vitest";
import { bindingsOf } from "../src/internal/bindingsOf.ts";
import { defaultError } from "../src/internal/defaultError.ts";

it("an action file that imports the contract loads before routes.ts and routes.ts binds it", async () => {
  const { save } = await import("./cycle/save.server.ts");
  const { routes } = await import("./cycle/routes.ts");
  expect(save.id).toBe("cyc.page");
  expect(routes.contract.module).toBe("cyc");
  expect(bindingsOf(routes).get("cyc.page")?.binding).toMatchObject({ POST: save });
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
