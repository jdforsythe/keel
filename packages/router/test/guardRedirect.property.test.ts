// Properties of the guard redirect helpers (k.router Guards, rfc:0051): `next` never nests, loops and a ninth hop are E1508.
// Seed 1337.
import { err, s } from "@keel/schema";
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { guard } from "../src/guard.ts";
import { MAX_GUARD_HOPS } from "../src/internal/MAX_GUARD_HOPS.ts";
import { MAX_NEXT_LENGTH } from "../src/internal/MAX_NEXT_LENGTH.ts";
import { carriedNext } from "../src/internal/carriedNext.ts";
import { compileRoutes, compileTable, guardLoop, guardNext, withNext } from "../src/internal/index.ts";
import { nextOf } from "../src/internal/nextOf.ts";
import type { RouteDef } from "../src/types/RouteDef.ts";

const SEED = 1337;
const Denied = s.error("keel.denied", s.object({}));
const auth = guard({ redirect: "app.login" }, async () => err(Denied.make({})));
const Page = () => document.createTextNode("");
const defs: Record<string, RouteDef> = {
  "app.login": { path: "/login", component: Page },
  "app.list": { path: "/list", component: Page, guard: auth },
};
const table = compileTable(compileRoutes(defs), defs);
const segment = fc.stringMatching(/^[a-z0-9]{1,6}$/);
const appPath = fc
  .tuple(
    fc.array(segment, { minLength: 1, maxLength: 3 }),
    fc.dictionary(segment, fc.string({ maxLength: 8 }), { maxKeys: 3 }),
  )
  .filter(([parts]) => parts[0] !== "login")
  .map(([parts, q]) => {
    const query = new URLSearchParams(Object.entries(q).filter(([k]) => k !== "next")).toString();
    return `/${parts.join("/")}${query === "" ? "" : `?${query}`}`;
  });

describe("guard redirect helpers", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("nextOf reads back what withNext wrote", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20, unit: "binary" }), (v) => {
        expect(nextOf(withNext("/login", v))).toBe(v);
        expect(nextOf(withNext("/login?x=1", v))).toBe(v);
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("a carried next resolves to the same origin and has no control character, for arbitrary strings (backlog 0145)", () => {
    const tricky = fc.constantFrom(
      "/",
      "//",
      "/\\",
      "/\t/",
      "/\n/",
      "\t",
      "%2F",
      "evil.example",
      "http://k",
      "?",
      "#",
      "\u0000",
      "\u007f",
    );
    const value = fc
      .array(fc.oneof(tricky, fc.string({ maxLength: 6, unit: "binary" })), { maxLength: 6 })
      .map((xs) => xs.join(""));
    fc.assert(
      fc.property(value, (v) => {
        const carried = guardNext(table, withNext("/login", v));
        if (carried === "/login") return;
        expect(carried).toBe(v);
        expect(new URL(carried, "http://k").origin).toBe("http://k");
        expect([...carried].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)).toBe(false);
        expect(carried.startsWith("//") || carried.startsWith("/\\")).toBe(false);
      }),
      { seed: SEED, numRuns: 1000 },
    );
  });

  it("tab, newline, backslash and other origins are dropped, not carried (backlog 0145)", () => {
    for (const v of [
      "/\t/evil.example",
      "/\n/evil.example",
      "/\t\\evil.example",
      "/\r/evil.example",
      "//evil.example",
      "/\\evil.example",
      "https://evil.example",
      "/a\u0000b",
    ]) {
      expect(carriedNext(v)).toBe(false);
      expect(guardNext(table, withNext("/login", v))).toBe("/login");
    }
    expect(guardNext(table, "/login?next=%2F%09%2Fevil.example&x=1")).toBe("/login?x=1");
    expect(carriedNext("/a?b=1#c")).toBe(true);
  });

  it("guardNext unwraps any depth of redirect-route wrapping to the original URL, which carries no next", () => {
    fc.assert(
      fc.property(appPath, fc.nat({ max: 6 }), (original, depth) => {
        let url = original;
        for (let i = 0; i < depth; i++) url = withNext("/login", url);
        const next = guardNext(table, url);
        expect(next).toBe(original);
        expect(nextOf(next)).toBeNull();
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("a next on a route no guard redirects to is part of the URL, not unwrapped", () => {
    expect(guardNext(table, "/list?next=%2Fpage2")).toBe("/list?next=%2Fpage2");
  });

  it("unwrapping stops after MAX_GUARD_HOPS levels and drops a next over MAX_NEXT_LENGTH (backlog 0146)", () => {
    const wrap = (depth: number) => {
      let url = "/a";
      for (let i = 0; i < depth; i++) url = withNext("/login", url);
      return url;
    };
    expect(guardNext(table, wrap(MAX_GUARD_HOPS))).toBe("/a");
    expect(guardNext(table, wrap(MAX_GUARD_HOPS + 1))).toBe("/login");
    expect(guardNext(table, withNext("/login", `/a?x=${"y".repeat(MAX_NEXT_LENGTH)}`))).toBe("/login");
    expect(guardNext(table, withNext("/login", `/a?x=${"y".repeat(MAX_NEXT_LENGTH - 5)}`))).toHaveLength(
      MAX_NEXT_LENGTH,
    );
  });

  it("a 16 KB nested next costs a bounded number of query parses, not one per level (backlog 0146)", () => {
    const Real = URLSearchParams;
    let parses = 0;
    vi.stubGlobal(
      "URLSearchParams",
      class extends Real {
        constructor(init?: string) {
          super(init);
          parses++;
        }
      },
    );
    const raw = `${"/login?next=".repeat(1400)}/a`;
    expect(raw.length).toBeGreaterThan(16_000);
    expect(guardNext(table, raw)).toBe("/login");
    expect(parses).toBeLessThanOrEqual(2 * (MAX_GUARD_HOPS + 1));
  });

  it("guardLoop lets distinct locations through up to the eighth redirect and stops a revisit or a ninth", () => {
    fc.assert(
      fc.property(fc.uniqueArray(appPath, { minLength: 2, maxLength: MAX_GUARD_HOPS + 2 }), (urls) => {
        const to = urls[urls.length - 1] ?? "/";
        const visited = urls.slice(0, -1);
        const verdict = guardLoop(visited, to);
        if (visited.length <= MAX_GUARD_HOPS) expect(verdict).toBeNull();
        else expect(verdict).toBe(`more than 8 guard redirects from ${visited[0]}`);
        const back = visited[visited.length - 1] ?? "/";
        expect(guardLoop(visited, back)).toBe(`guard redirect loop: ${[...visited, back].join(" -> ")}`);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});
