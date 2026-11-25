// @vitest-environment happy-dom
// k.router (Links) "`Link to`, `navigate`, `Form action` and an action's `ok` take `Href` only, rechecked when run (server and client): else `Link` renders `about:blank`, `Form` throws E1501, `ok` is `keel.unexpected` (nothing saved or followed), and `navigate` rejects (E1501) unless it is one once `\` reads as `/` and `#…` drops."
// rfc:0157 conformance: for generated action results (`null`, `c.href` links, strings from a hostile alphabet), after a submit over each transport the next location (a 303 `location`, a JSON `value`) is `null` or a path of the origin.
// The client transport is in packages/testing/conformance/form-ok-location-on-origin.test.ts.
// Seed 1337 (fc.assert below).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, itemHref, setup } from "./ok-not-href-support.ts";

const ORIGIN = "http://localhost";
const hostile = fc
  .array(fc.constantFrom("/", "\\", "/", "a", "b", ".", ":", "%", "#", "?", "\n", "\u0085", "\u007f", "@", "x"), {
    maxLength: 10,
  })
  .map((cs) => cs.join(""));
const result = fc.oneof(
  fc.constant(null),
  fc.stringMatching(/^[a-z0-9]{1,8}$/).map((slug) => itemHref(slug)),
  hostile,
  hostile.map((h) => `/${h}`),
  hostile.map((h) => `//${h}`),
  hostile.map((h) => `https://${h}`),
);
const onOrigin = (at: string | null): boolean =>
  at === null ||
  (new URL(at, ORIGIN).origin === ORIGIN && at.startsWith("/") && !at.startsWith("//") && !at.includes("\\"));

describe("rfc:0157 conformance: the next location of a submit is null or a path of the origin", () => {
  it("after a document POST, any 303 `location` is a path of the origin and any other answer has none", async () => {
    const t = await setup();
    await fc.assert(
      fc.asyncProperty(result, async (to) => {
        const res = await t.document(to);
        const location = res.headers.get("location");
        if (res.status >= 300 && res.status < 400) expect(location, JSON.stringify(to)).not.toBeNull();
        else expect(location, JSON.stringify(to)).toBeNull();
        expect(onOrigin(location), JSON.stringify(to)).toBe(true);
      }),
      { seed: SEED, numRuns: 120 },
    );
  });

  it("after a JSON POST, an `ok` answer's `value` is `null` or a path of the origin, and any other answer has no `value`", async () => {
    const t = await setup();
    await fc.assert(
      fc.asyncProperty(result, async (to) => {
        const res = await t.json(to);
        const body: unknown = await res.json();
        const value: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "value") : undefined;
        if (res.status === 200) {
          expect(value === null || typeof value === "string", JSON.stringify(to)).toBe(true);
          expect(onOrigin(typeof value === "string" ? value : null), JSON.stringify(to)).toBe(true);
        } else {
          expect(res.status).toBe(500);
          expect(value, JSON.stringify(to)).toBeUndefined();
        }
      }),
      { seed: SEED, numRuns: 120 },
    );
  });
});
