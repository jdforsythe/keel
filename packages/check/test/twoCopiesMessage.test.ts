// Seed 1337. E1765's message at check (k.realm One copy): within 89 units, each folder shortened by its forms so the
// dependency that holds a copy stays named.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { twoCopiesMessage } from "../src/internal/twoCopiesMessage.ts";

const LEAD = "two copies of @keel/schema in one realm: ";

describe("twoCopiesMessage", () => {
  it("keeps both folders whole when they fit", () => {
    expect(twoCopiesMessage("@keel/schema", "vendor/schema", "x/node_modules/@keel/schema")).toBe(
      `${LEAD}vendor/schema and x/node_modules/@keel/schema`,
    );
  });

  it("shortens the first folder before the second, and keeps the second from its holder on", () => {
    expect(
      twoCopiesMessage("@keel/schema", "node_modules/@keel/schema", "node_modules/dep/node_modules/@keel/schema"),
    ).toBe(`${LEAD}.../schema and .../dep/node_modules/@keel/schema`);
  });

  it("names a longer holder by its holder and last segment", () => {
    expect(
      twoCopiesMessage("@keel/schema", "node_modules/@keel/schema", "node_modules/left-pad/node_modules/@keel/schema"),
    ).toBe(`${LEAD}.../schema and .../left-pad/.../schema`);
  });

  it("keeps a holder's scope", () => {
    expect(
      twoCopiesMessage("@keel/schema", "node_modules/@keel/schema", "node_modules/@acme/ui-kit/node_modules/@keel/schema"),
    ).toBe(`${LEAD}.../schema and .../@acme/ui-kit/.../schema`);
  });

  it("cuts a holder past the room at its end, a pnpm folder's among them", () => {
    const pnpm = "node_modules/.pnpm/@acme+ui-kit@1.2.3_react@18.3.1_react-dom@18.3.1/node_modules/@keel/schema";
    expect(twoCopiesMessage("@keel/schema", "node_modules/@keel/schema", pnpm)).toBe(
      `${LEAD}.../schema and .../@acme+ui-kit@1.2.3_.../schema`,
    );
  });

  it("splits the room when both holders are long", () => {
    const m = twoCopiesMessage(
      "@keel/schema",
      "node_modules/.pnpm/a-very-long-name-here@1.0.0/node_modules/@keel/schema",
      "node_modules/.pnpm/another-very-long-one@2.0.0/node_modules/@keel/schema",
    );
    expect(m).toBe(`${LEAD}.../a-very-.../schema and .../another-.../schema`);
  });

  it("is at most 89 units and names each holder's first unit, for any folders", () => {
    const seg = fc.stringMatching(/^[a-z@.+_-][a-z0-9@.+_-]{0,40}$/);
    const name = fc.constantFrom("@keel/schema", "@keel/store", "@keel/router", "@keel/server");
    fc.assert(
      fc.property(name, fc.array(seg, { maxLength: 4 }), seg, fc.array(seg, { maxLength: 4 }), seg, (n, p1, h1, p2, h2) => {
        const first = [...p1, h1, "node_modules", n].join("/");
        const second = [...p2, h2, "node_modules", n].join("/");
        const m = twoCopiesMessage(n, first, second);
        expect(m.length).toBeLessThanOrEqual(89);
        expect(m.startsWith(`two copies of ${n} in one realm: `)).toBe(true);
        const [a = "", b = ""] = m.slice(`two copies of ${n} in one realm: `.length).split(" and ");
        expect(a.endsWith(n.slice("@keel/".length))).toBe(true);
        expect(b.endsWith(n.slice("@keel/".length))).toBe(true);
      }),
      { seed: 1337, numRuns: 500 },
    );
  });
});
