// k.privacy Sinks, the `req` path: a `.pii()` param is `[pii]` by the line-up and cut a secret param uses, `[secret]`
// wins at one segment, and a table with a secret param cuts at an encoded separator. Seed 1337.
import { type RouteTable, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { compileRoutes } from "@keel/router/internal";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { secretSegments } from "../src/internal/secretSegments.ts";

const SEED = 1337;
const view = (): Node => document.createElement("main");
const marksOf = (table: RouteTable) => secretSegments(compileRoutes(table).located);

const resetC = contract("app", {
  "app.r": { path: "/reset/:token", params: s.object({ token: s.secret(s.string()) }) },
});
const reset = manifest(resetC, { "app.r": { component: view } });

const word = fc.stringMatching(/^[a-z]{2,6}$/);
// What sits at a marked param and after it: upper-case letters and digits, which no static text or plain value holds.
const value = fc.stringMatching(/^[A-Z0-9]{1,12}$/);
const tail = fc.array(fc.stringMatching(/^[A-Z0-9]{1,8}$/), { maxLength: 4 });
type Kind = "pii" | "secret" | "both";
const kind = fc.constantFrom<Kind>("pii", "secret", "both");

const fieldOf = (k: Kind) =>
  k === "pii" ? s.string().pii("contact") : k === "secret" ? s.secret(s.string()) : s.secret(s.string().pii("contact"));
const markOf = (k: Kind) => (k === "pii" ? "[pii]" : "[secret]");

describe("secretSegments with .pii() params", () => {
  it("leaves no character of a marked segment or of anything after a cut, for any table of pii and secret routes", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ head: word, k: kind, after: fc.array(word, { maxLength: 2 }) }), {
          minLength: 1,
          maxLength: 4,
        }),
        fc.nat(),
        value,
        tail,
        (routes, pick, v, rest) => {
          const c = contract(
            "app",
            Object.fromEntries(
              routes.map((r, i) => [
                `app.r${i}`,
                { path: `/${[r.head, ":m", ...r.after, `z${i}`].join("/")}`, params: s.object({ m: fieldOf(r.k) }) },
              ]),
            ),
          );
          const table = manifest(c, Object.fromEntries(routes.map((_, i) => [`app.r${i}`, { component: view }])));
          const chosen = routes[pick % routes.length];
          if (chosen === undefined) return;
          const shown = marksOf(table)(`/${[chosen.head, v, ...rest].join("/")}`);
          expect(shown).not.toMatch(/[A-Z0-9]/);
          const marks = routes.filter((r) => r.head === chosen.head).map((r) => markOf(r.k));
          expect(shown).toBe(`/${chosen.head}/${marks.includes("[secret]") ? "[secret]" : "[pii]"}`);
        },
      ),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("reads a field as .pii() when a node above it is marked", () => {
    const wc = contract("app", {
      "app.u": { path: "/u/:email", params: s.object({ email: s.string() }).pii("contact") },
    });
    const whole = marksOf(manifest(wc, { "app.u": { component: view } }));
    expect(whole("/u/A@B")).toBe("/u/[pii]");
    const oc = contract("app", {
      "app.u": { path: "/u/:email", params: s.object({ email: s.string().pii("contact").optional() }) },
    });
    const opt = marksOf(manifest(oc, { "app.u": { component: view } }));
    expect(opt("/u/A@B/C")).toBe("/u/[pii]");
    const pc = contract("app", { "app.u": { path: "/u/:email", params: s.object({ email: s.string() }) } });
    const plain = marksOf(manifest(pc, { "app.u": { component: view } }));
    expect(plain("/u/A@B/C")).toBe("/u/A@B/C");
  });

  it("takes the earliest cut, its tail marked as the segment it was cut at", () => {
    const c = contract("app", {
      "app.a": { path: "/k/:who/x", params: s.object({ who: s.string().pii("contact") }) },
      "app.b": { path: "/k/:a/:tok", params: s.object({ a: s.string(), tok: s.secret(s.string()) }) },
    });
    const marks = marksOf(manifest(c, { "app.a": { component: view }, "app.b": { component: view } }));
    expect(marks("/k/A/B/C")).toBe("/k/[pii]");
    expect(marks("/k/A")).toBe("/k/[pii]");
  });

  it("marks a lone segment [secret] where a pii and a secret param both stand", () => {
    const c = contract("app", {
      "app.a": { path: "/u/:e", params: s.object({ e: s.string().pii("contact") }) },
      "app.b": { path: "/u/:t/x", params: s.object({ t: s.secret(s.string()) }) },
    });
    const marks = marksOf(manifest(c, { "app.a": { component: view }, "app.b": { component: view } }));
    expect(marks("/u/A")).toBe("/u/[secret]");
    expect(marks("/U/A/B")).toBe("/U/[secret]");
  });
});

describe("secretSegments at an encoded separator", () => {
  const sepChars = fc.constantFrom("%2F", "%2f", "%5C", "%5c");
  it("cuts as [secret] at the first segment holding one when the table has a secret param", () => {
    const marks = marksOf(reset);
    fc.assert(
      fc.property(fc.array(word, { maxLength: 3 }), word, sepChars, value, tail, (before, w, sep, v, rest) => {
        const shown = marks(`/${[...before, `${w}${sep}${v}`, ...rest].join("/")}`);
        expect(shown).toBe(`/${[...before, "[secret]"].join("/")}`);
        expect(shown).not.toMatch(/[A-Z0-9%]/);
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("does not cut in a table whose only marked params are .pii()", () => {
    const uc = contract("app", {
      "app.u": { path: "/u/:email", params: s.object({ email: s.string().pii("contact") }) },
    });
    const marks = marksOf(manifest(uc, { "app.u": { component: view } }));
    fc.assert(
      fc.property(word, sepChars, value, (w, sep, v) => {
        const path = `/${w}${sep}${v}`;
        expect(marks(path)).toBe(path);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("does not cut at a double encoding", () => {
    const marks = marksOf(reset);
    expect(marks("/files/a%252Fb")).toBe("/files/a%252Fb");
  });
});
