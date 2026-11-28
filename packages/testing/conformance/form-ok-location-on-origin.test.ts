// @vitest-environment happy-dom
// k.router (Links) "`Link to`, `navigate`, `Form action` and an action's `ok` take `Href` only, rechecked when run (server and client): else `Link` renders `about:blank`, `Form` throws E1501, `ok` is `keel.unexpected` (nothing saved or followed), and `navigate` rejects (E1501) unless it is one once `\` reads as `/` and `#…` drops."
// rfc:0157 conformance: for generated action results (`null`, `c.href` links, strings from a hostile alphabet), after a submit over each transport the next location (a client navigation) is `null` or a path of the origin.
// The 303 and JSON transports are in packages/server/conformance/action-ok-next-location-on-origin.test.ts.
// Seed 1337 (fc.assert below). The client's next location is each document navigation the page started: a path of the origin, or none.
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { SEED, homeHref, open } from "./ok-not-href-client-support.ts";

const opened: { dispose(): void }[] = [];
afterEach(() => {
  for (const h of opened.splice(0)) h.dispose();
});
const ORIGIN = "http://localhost";
const hostile = fc
  .array(fc.constantFrom("/", "\\", "/", "a", "b", ".", ":", "%", "#", "?", "\n", "\u0085", "\u007f", "@", "x"), {
    maxLength: 10,
  })
  .map((cs) => cs.join(""));
const result = fc.oneof(
  fc.constant(null),
  fc.constant(homeHref),
  hostile,
  hostile.map((h) => `/${h}`),
  hostile.map((h) => `//${h}`),
  hostile.map((h) => `https://${h}`),
);

describe("rfc:0157 conformance: after a client Form submit the next location is null or a path of the origin", () => {
  it("every document navigation started is a path of the origin, and the route stays a page of the table", async () => {
    await fc.assert(
      fc.asyncProperty(result, async (to) => {
        const h = await open(to);
        opened.push(h);
        await h.fire("cl.go", { type: "click" });
        for (const nav of h.documents()) {
          expect(
            nav.url.startsWith("/") && !nav.url.startsWith("//") && !nav.url.includes("\\"),
            JSON.stringify(to),
          ).toBe(true);
          expect(new URL(nav.url, ORIGIN).origin, JSON.stringify(to)).toBe(ORIGIN);
        }
        expect(["cl.form", "cl.home"], JSON.stringify(to)).toContain(h.route().id);
        h.dispose();
      }),
      { seed: SEED, numRuns: 60 },
    );
  });
});
