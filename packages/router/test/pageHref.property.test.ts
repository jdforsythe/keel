// Properties of `pageHref` (k.router Return targets): whatever text it is given, an answer is a page of the app's own
// origin, rebuilt and idempotent, and a refusal is the same value. Seed 1337.
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { guard } from "../src/guard.ts";
import { returnRefused } from "../src/internal/returnRefused.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import { pageHref } from "../src/match/pageHref.ts";
import { routeTable } from "../src/routeTable.ts";

const opts = { seed: 1337, numRuns: 1000 };
const ORIGIN = "https://app.example";
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

const shop = contract("pgshop", {
  "pgshop.list": { path: "/list", search: s.object({ tab: s.enum(["a", "b"]).optional(), n: s.int().optional() }) },
  "pgshop.item": { path: "/items/:id", params: s.object({ id: s.int({ min: 1 }) }) },
  "pgshop.name": { path: "/names/:name", params: s.object({ name: s.string({ min: 1 }) }) },
  "pgshop.signin": { path: "/signin", search: s.object({ next: s.string().optional() }) },
  "pgshop.items": { method: "GET", path: "/api/items", output: s.object({ n: s.int() }) },
});
const view = (): Node => document.createComment("");
const g = guard({ redirect: "pgshop.signin" }, async () => ok(null));
const t = manifest(shop, {
  "pgshop.list": { component: view },
  "pgshop.item": { component: view, guard: g },
  "pgshop.name": { component: view },
  "pgshop.signin": { component: view },
  "pgshop.items": { loader: loader(shop, "pgshop.items", {}, async () => ok({ n: 1 })) },
});

const piece = fc.constantFrom(
  "/",
  "//",
  "\\",
  "%2F",
  "%2f",
  "%5C",
  "%5c",
  "%2e",
  "%2E",
  "%252F",
  "%",
  "%0",
  ".",
  "..",
  "?",
  "#",
  "&",
  "=",
  "tab=b",
  "n=3",
  "list",
  "items",
  "names",
  "7",
  "signin",
  "api",
  "\t",
  "\n",
  "\u0085",
  "https:",
  "evil.example",
  "@",
  "∕",
  "／",
);
const text = fc.oneof(
  fc.string({ maxLength: 60 }),
  fc.string({ unit: "binary", maxLength: 30 }),
  fc.array(piece, { maxLength: 12 }).map((p) => p.join("")),
  fc.array(piece, { maxLength: 12 }).map((p) => `/${p.join("")}`),
  fc.constantFrom("/list", "/items/7", "/list?tab=b#top", "/names/a%20b", "/api/items", "/signin"),
);

describe("pageHref properties", () => {
  it("an answer, parsed against a foreign origin, keeps that origin, one leading slash, no backslash, control character or hash", () => {
    fc.assert(
      fc.property(text, (x) => {
        const r = pageHref(t, x);
        if (!r.ok) return;
        const u = new URL(r.value, ORIGIN);
        expect(u.origin).toBe(ORIGIN);
        expect(u.hash).toBe("");
        expect(r.value.startsWith("/") && !r.value.startsWith("//")).toBe(true);
        expect(r.value.includes("\\") || r.value.includes("#") || CONTROL.test(r.value)).toBe(false);
        expect(new URL(r.value, ORIGIN).pathname.startsWith("//")).toBe(false);
      }),
      opts,
    );
  });

  it("an answer is idempotent: reading it again gives itself", () => {
    fc.assert(
      fc.property(text, (x) => {
        const r = pageHref(t, x);
        if (r.ok) expect(pageHref(t, r.value)).toEqual(r);
      }),
      opts,
    );
  });

  it("text a URL parser reads as another origin is refused, never rewritten into an answer", () => {
    fc.assert(
      fc.property(text, (x) => {
        const hostile = URL.canParse(x, ORIGIN) ? new URL(x, ORIGIN).origin !== ORIGIN : true;
        if (hostile) expect(pageHref(t, x).ok).toBe(false);
      }),
      opts,
    );
  });

  it("a refusal is `keel.notFound`, message `not a page`, data `null`, and echoes none of the text", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 3, maxLength: 80 }), (x) => {
        const r = pageHref(t, x);
        if (r.ok) return;
        expect(r.error).toEqual({ code: "keel.notFound", message: "not a page", data: null });
      }),
      opts,
    );
  });

  it("the guard's redirect page is never an answer, whatever its query", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (q) => {
        expect(pageHref(t, `/signin?next=${encodeURIComponent(q)}`).ok).toBe(false);
      }),
      opts,
    );
  });

  it("a param that decodes to a slash, a backslash or a dot segment is never an answer", () => {
    for (const p of ["%2F", "%2f", "%5C", "%5c", ".", "..", "%2E", "%2e%2E", "a%2Fb", "%252F"]) {
      const r = pageHref(t, `/names/${p}`);
      if (p === "%252F") expect(r).toEqual({ ok: true, value: "/names/%252F" });
      else expect(r.ok).toBe(false);
    }
  });

  it("an empty table, and one with no such page, refuse every text", () => {
    fc.assert(
      fc.property(text, (x) => {
        expect(pageHref(routeTable(), x).ok).toBe(false);
      }),
      { seed: 1337, numRuns: 200 },
    );
  });

  it("text of 2,048 characters built to make a matcher backtrack is answered at once", () => {
    const start = performance.now();
    const hard = [
      `/${"/".repeat(2047)}`,
      `/${"a/".repeat(1023)}x`,
      `/list?${"&".repeat(2041)}`,
      `/list?${"a=%".repeat(680)}`,
      `/${"%2".repeat(682)}`,
      `/${"%2e".repeat(682)}`,
      `/${"/..".repeat(682)}`,
      `/names/${"%C3".repeat(680)}`,
      `/list/${"/".repeat(2040)}x`,
      `${"/".repeat(2047)}a`,
    ];
    for (const x of hard) pageHref(t, x);
    expect(performance.now() - start).toBeLessThan(500);
  });

  it("`returnRefused` refuses over 2,048 characters and accepts exactly 2,048", () => {
    expect(returnRefused(`/${"a".repeat(2047)}`)).toBe(false);
    expect(returnRefused(`/${"a".repeat(2048)}`)).toBe(true);
  });

  it("`returnRefused` looks at `%2F` and `%5C` only before the first `?` or `#`", () => {
    expect(returnRefused("/a?x=%2F")).toBe(false);
    expect(returnRefused("/a#%5C")).toBe(false);
    expect(returnRefused("/a%2fb?x")).toBe(true);
    expect(returnRefused("/a%5Cb")).toBe(true);
    expect(returnRefused("/a/%2e%2E/b")).toBe(true);
    expect(returnRefused("/a/b/..")).toBe(true);
    expect(returnRefused("/a/b/..?x")).toBe(true);
    expect(returnRefused("/a/..b/c.d")).toBe(false);
  });
});
