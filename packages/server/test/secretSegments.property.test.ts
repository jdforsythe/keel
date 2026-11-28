// k.privacy Sinks, the `req` path: a path that lines up with a secret route through the secret's segment keeps the
// segments before it and is `[secret]` from there on, one mark for any tail; a path no route lines up with comes back
// as it came. Seed 1337.
import { type RouteTable, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { compileRoutes } from "@keel/router/internal";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { secretSegments } from "../src/internal/secretSegments.ts";

const SEED = 1337;
const view = (): Node => document.createElement("main");
const marksOf = (routes: RouteTable) => secretSegments(compileRoutes(routes).located);

// A route led by `lead` (a static text, then static texts or plain params as `null`), then the secret, then `after`
// static texts. A route led by a param lines up with every path one segment shorter too; its own case is below.
const word = fc.stringMatching(/^[a-z]{2,6}$/);
const shape = fc.record({
  lead: fc
    .tuple(word, fc.array(fc.option(word, { nil: null }), { maxLength: 3 }))
    .map(([first, rest]): (string | null)[] => [first, ...rest]),
  after: fc.array(word, { maxLength: 2 }),
});
// What sits at the secret and after it: upper-case letters and digits, which no static text or plain value holds.
const value = fc.stringMatching(/^[A-Z0-9]{1,12}$/);
const tail = fc.array(fc.stringMatching(/^[A-Z0-9]{1,8}$/), { maxLength: 4 });

function routeOf(lead: readonly (string | null)[], after: readonly string[]): RouteTable {
  const parts = lead.map((t, i) => (t === null ? `:p${i}` : t));
  const fields = Object.fromEntries(lead.flatMap((t, i) => (t === null ? [[`p${i}`, s.string()]] : [])));
  const params = s.object({ ...fields, tok: s.secret(s.string()) });
  const c = contract("app", { "app.r": { path: `/${[...parts, ":tok", ...after].join("/")}`, params } });
  return manifest(c, { "app.r": { component: view } });
}

describe("secretSegments", () => {
  it("keeps the segments before the secret and writes one [secret] for it and everything after", () => {
    fc.assert(
      fc.property(shape, value, tail, ({ lead, after }, v, rest) => {
        const marks = marksOf(routeOf(lead, after));
        const before = lead.map((t, i) => (t === null ? `v${String.fromCharCode(97 + i)}x` : t));
        const shown = marks(`/${[...before, v, ...rest].join("/")}`);
        expect(shown).toBe(`/${[...before, "[secret]"].join("/")}`);
        expect(shown).not.toMatch(/[A-Z0-9]/);
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("marks only the secret segment when nothing but empty segments follows it", () => {
    const marks = marksOf(routeOf(["reset"], []));
    expect(marks("/reset/TOK")).toBe("/reset/[secret]");
    expect(marks("//reset//TOK//")).toBe("//reset/[secret]");
  });

  it("cuts at the earliest secret and keeps a mark before it", () => {
    const c = contract("app", {
      "app.one": { path: "/k/:tok/more", params: s.object({ tok: s.secret(s.string()) }) },
      "app.two": { path: "/k/:a/:tok", params: s.object({ a: s.string(), tok: s.secret(s.string()) }) },
      "app.three": {
        path: "/m/:tok/:b/:c",
        params: s.object({ tok: s.secret(s.string()), b: s.string(), c: s.string() }),
      },
    });
    const routes = manifest(c, {
      "app.one": { component: view },
      "app.two": { component: view },
      "app.three": { component: view },
    });
    const marks = marksOf(routes);
    expect(marks("/k/A/B")).toBe("/k/[secret]");
    expect(marks("/k/A")).toBe("/k/[secret]");
    expect(marks("/m/A/B/C")).toBe("/m/[secret]");
  });

  it("gives a path no route lines up with, and any path of a table without a secret, as it came", () => {
    fc.assert(
      fc.property(shape, value, tail, ({ lead, after }, v, rest) => {
        const marks = marksOf(routeOf(lead, after));
        const path = `/zz${[...lead.map((t, i) => t ?? `v${i}`), v, ...rest].join("/")}`;
        expect(marks(path)).toBe(path);
        const pc = contract("app", { "app.p": { path: "/p/:a", params: s.object({ a: s.string() }) } });
        const plain = marksOf(manifest(pc, { "app.p": { component: view } }));
        expect(plain(path)).toBe(path);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("marks every path of two or more segments whole when the secret follows only a prefix param", () => {
    const marks = marksOf(routeOf([null], []));
    expect(marks("/A")).toBe("/[secret]");
    expect(marks("/en/A")).toBe("/[secret]");
    expect(marks("/en/A/B")).toBe("/[secret]");
  });

  it("costs time linear in the path length", () => {
    const marks = marksOf(routeOf(["reset"], []));
    const long = `/reset/${"A/".repeat(200_000)}B`;
    expect(marks(long)).toBe("/reset/[secret]");
  });
});
