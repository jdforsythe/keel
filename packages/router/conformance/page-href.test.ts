// @vitest-environment happy-dom
// Spec: k.router#17, clause "Over table `t`, module `shop`'s manifest with pages `shop.list` (`/list`, search `s.object({ tab: s.enum(['a', 'b']).optional() })`, `POST: a`, `a` an action whose `fn` records the `routes` it gets and returns `ok(null)`), `shop.item` (`/items/:id`, params `s.object({ id: s.int({ min: 1 }) })`, guard `g` with `redirect: 'shop.signin'`) and `shop.signin` (`/signin`, search `s.object({ next: s.string().optional() })`), and API entry `shop.items` (`/api/items`, `GET`): `pageHref(t, x)` is `ok('/list')` for each `x` of `'/list'`, `'/list/'`, `'/list?tab=zzz'`, `'/list?x=1#top'` and `'/list?p='` followed by 2,040 `a` characters (2,048 in all); `ok('/list?tab=b')` for `'/list?x=1&tab=b#top'`; `ok('/items/7')` for `'/items/7'`; each `ok` value equals `shop.href` of the same id, params and search."
// Spec: k.router#18, clause "Over `t` as above, `pageHref(t, x)` is `err` with code `keel.notFound`, message `not a page` and data `null` for each `x` of these JavaScript string literals: `''`, `'list'`, `' /list'`, `'https://evil.example/list'`, `'javascript:alert(1)'`, `'//evil.example/list'`, `'/\\evil.example/list'`, `'/list\\'`, `'/\t/evil.example/list'`, `'/list\n'`, `'/list\u007f'`, `'/list\u0085'`, `'/%2F%2Fevil.example'`, `'/%2f%2fevil.example'`, `'/items/1%2F2'`, `'/items/%5C7'`, `'/list/../items/7'`, `'/items/%2E%2E'`, `'/api/items'`, `'/nowhere'`, `'/items/0'`, `'/items/x'`, `'/signin'`, `'/signin?next=%2Flist'`, and `'/list?p='` followed by 2,041 `a` characters (2,049 in all)."
// Seed 1337 (fc.assert below). The fixture `t` is the spec's: module `shop`, pages `shop.list`, `shop.item`, `shop.signin`, API entry `shop.items`.
// Assumes `Result` is `{ ok: true, value } | { ok: false, error: { code, message, data } }` and the identity mount's path is not a page of `t`.
import type { Href } from "@keel/router";
import { action, guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { matchHref, pageHref } from "@keel/router/match";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const RUNS = 300;
const opts = { seed: SEED, numRuns: RUNS };

const ListSearch = s.object({ tab: s.enum(["a", "b"]).optional() });
const ItemParams = s.object({ id: s.int({ min: 1 }) });
const SigninSearch = s.object({ next: s.string().optional() });
const Out = s.object({ n: s.int() });
const shop = contract("shop", {
  "shop.list": { path: "/list", search: ListSearch },
  "shop.item": { path: "/items/:id", params: ItemParams },
  "shop.signin": { path: "/signin", search: SigninSearch },
  "shop.items": { method: "GET", path: "/api/items", output: Out },
});
const node = (): Node => document.createElement("div");
const save = action(shop, "shop.list", { input: s.object({}) }, async () => ok(null));
const g = guard({ redirect: "shop.signin" }, async () => ok(null));
const t = manifest(shop, {
  "shop.list": { component: node, POST: save },
  "shop.item": { component: node, guard: g },
  "shop.signin": { component: node },
  "shop.items": { loader: loader(shop, "shop.items", {}, async () => ok({ n: 1 })) },
});

const A = "a".repeat(2040);
const refusedCodes = (r: ReturnType<typeof pageHref>): unknown =>
  r.ok ? "ok" : { code: r.error.code, message: r.error.message, data: r.error.data };
const NOT_A_PAGE = { code: "keel.notFound", message: "not a page", data: null };
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;

const hostile: readonly string[] = [
  "//evil.example",
  "/\\evil.example",
  "/\t/evil.example/x",
  "https://evil.example",
  "/%2F%2Fevil.example",
  "/%5Cevil.example",
  "/a/../b",
  "/a/%2e%2e/b",
  "javascript:alert(1)",
  "",
  `/${"a".repeat(2048)}`,
];

describe("k.router#17 pageHref accepts", () => {
  it("`pageHref(t, x)` is `ok('/list')` for `'/list'`, `'/list/'`, `'/list?tab=zzz'`, `'/list?x=1#top'` and a 2,048-character `'/list?p=aaa...'`", () => {
    const long = `/list?p=${A}`;
    expect(long).toHaveLength(2048);
    for (const x of ["/list", "/list/", "/list?tab=zzz", "/list?x=1#top", long]) {
      const r = pageHref(t, x);
      expect(r.ok, x).toBe(true);
      expect(r.ok ? r.value : null, x).toBe("/list");
    }
    expect(pageHref(t, "/list?p=")).toEqual({ ok: true, value: "/list" });
  });

  it("`pageHref(t, '/list?x=1&tab=b#top')` is `ok('/list?tab=b')`: a declared search key that parses survives, other keys and the hash drop", () => {
    expect(pageHref(t, "/list?x=1&tab=b#top")).toEqual({ ok: true, value: "/list?tab=b" });
  });

  it("`pageHref(t, '/items/7')` is `ok('/items/7')`, and each `ok` value equals `shop.href` of the same id, params and search", () => {
    expect(pageHref(t, "/items/7")).toEqual({ ok: true, value: "/items/7" });
    expect(shop.href("shop.item", { id: 7 })).toBe("/items/7");
    expect(shop.href("shop.list")).toBe("/list");
    expect(shop.href("shop.list", {}, { tab: "b" })).toBe("/list?tab=b");
  });

  it("for any page of `t` and any valid params and declared search values, `pageHref(t, href)` is `ok` of that same href", () => {
    const tab = fc.option(fc.constantFrom("a" as const, "b" as const), { nil: undefined });
    fc.assert(
      fc.property(
        fc.oneof(
          tab.map((v) => shop.href("shop.list", {}, v === undefined ? {} : { tab: v })),
          fc.integer({ min: 1, max: 1_000_000 }).map((id) => shop.href("shop.item", { id })),
        ),
        (href: Href) => {
          expect(pageHref(t, href)).toEqual({ ok: true, value: href });
        },
      ),
      opts,
    );
  });

  it("for any accepted input, extra undeclared query keys and a hash appended leave the answer unchanged", () => {
    const tab = fc.option(fc.constantFrom("a" as const, "b" as const), { nil: undefined });
    const base = fc.oneof(
      tab.map((v) => shop.href("shop.list", {}, v === undefined ? {} : { tab: v })),
      fc.integer({ min: 1, max: 1_000_000 }).map((id) => shop.href("shop.item", { id })),
    );
    const extra = fc.array(
      fc.tuple(
        fc.stringMatching(/^[a-z]{1,6}$/).filter((k) => k !== "tab"),
        fc.stringMatching(/^[a-zA-Z0-9]{0,6}$/),
      ),
      { maxLength: 4 },
    );
    const hash = fc.option(fc.stringMatching(/^[a-zA-Z0-9_-]{0,10}$/), { nil: undefined });
    fc.assert(
      fc.property(base, extra, hash, (href, more, h) => {
        const joined = more.map(([k, v]) => `${k}=${v}`).join("&");
        const withQuery = joined === "" ? href : `${href}${href.includes("?") ? "&" : "?"}${joined}`;
        const text = h === undefined ? withQuery : `${withQuery}#${h}`;
        expect(pageHref(t, text)).toEqual(pageHref(t, href));
      }),
      opts,
    );
  });
});

describe("k.router#18 pageHref refuses", () => {
  it("`pageHref(t, x)` is `err` `keel.notFound`, message `not a page`, data `null` for each listed literal", () => {
    const listed: readonly string[] = [
      "",
      "list",
      " /list",
      "https://evil.example/list",
      "javascript:alert(1)",
      "//evil.example/list",
      "/\\evil.example/list",
      "/list\\",
      "/\t/evil.example/list",
      "/list\n",
      "/list\u007f",
      "/list\u0085",
      "/%2F%2Fevil.example",
      "/%2f%2fevil.example",
      "/items/1%2F2",
      "/items/%5C7",
      "/list/../items/7",
      "/items/%2E%2E",
      "/api/items",
      "/nowhere",
      "/items/0",
      "/items/x",
      "/signin",
      "/signin?next=%2Flist",
      `/list?p=${A}a`,
    ];
    expect(listed[listed.length - 1]).toHaveLength(2049);
    for (const x of listed) expect(refusedCodes(pageHref(t, x)), JSON.stringify(x)).toEqual(NOT_A_PAGE);
  });

  it("hostile open-redirect inputs are each refused with `keel.notFound` `not a page`", () => {
    expect(hostile[hostile.length - 1]).toHaveLength(2049);
    for (const x of hostile) expect(refusedCodes(pageHref(t, x)), JSON.stringify(x)).toEqual(NOT_A_PAGE);
  });

  it("text longer than 2,048 characters is refused however it continues", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2049, max: 3000 }), (n) => {
        const x = `/list?p=${"a".repeat(n - 8)}`;
        expect(x).toHaveLength(n);
        expect(refusedCodes(pageHref(t, x))).toEqual(NOT_A_PAGE);
      }),
      opts,
    );
  });

  it("text that does not start with exactly one `/` is refused", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.stringMatching(/^[a-z][a-z0-9/.?=&-]{0,30}$/),
          fc.integer({ min: 2, max: 5 }).map((n) => `${"/".repeat(n)}list`),
          fc.constantFrom("", " /list", " /list", "http://x.example/list", "mailto:a@b.c"),
        ),
        (x) => {
          expect(refusedCodes(pageHref(t, x))).toEqual(NOT_A_PAGE);
        },
      ),
      opts,
    );
  });

  it("text holding a backslash or a C0, DEL or C1 control character anywhere is refused", () => {
    const ctl = fc.oneof(
      fc.integer({ min: 0x00, max: 0x1f }),
      fc.constant(0x7f),
      fc.integer({ min: 0x80, max: 0x9f }),
      fc.constant(0x5c),
    );
    fc.assert(
      fc.property(
        fc.constantFrom("/list", "/items/7", "/list?tab=a", "/list#h", "/list?tab=a#h"),
        ctl,
        fc.nat(),
        (base, c, at) => {
          const i = at % (base.length + 1);
          const x = `${base.slice(0, i)}${String.fromCharCode(c)}${base.slice(i)}`;
          expect(refusedCodes(pageHref(t, x)), JSON.stringify(x)).toEqual(NOT_A_PAGE);
        },
      ),
      opts,
    );
  });

  it("`%2F` or `%5C` in either case before the first `?` or `#` is refused", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("%2F", "%2f", "%5C", "%5c"),
        fc.constantFrom("/list", "/items/7", "/items/"),
        (enc, base) => {
          expect(refusedCodes(pageHref(t, `${base}${enc}`))).toEqual(NOT_A_PAGE);
          expect(refusedCodes(pageHref(t, `${base}${enc}x`))).toEqual(NOT_A_PAGE);
          expect(refusedCodes(pageHref(t, `${enc}${base}`))).toEqual(NOT_A_PAGE);
        },
      ),
      opts,
    );
  });

  it("a path segment that is `.` or `..` once percent-decoded is refused", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(".", "..", "%2e", "%2E", "%2e%2e", "%2E%2E", ".%2e", "%2e."),
        fc.constantFrom("/list/", "/items/", "/items/7/", "/"),
        (seg, prefix) => {
          expect(refusedCodes(pageHref(t, `${prefix}${seg}`))).toEqual(NOT_A_PAGE);
          expect(refusedCodes(pageHref(t, `${prefix}${seg}/list`))).toEqual(NOT_A_PAGE);
        },
      ),
      opts,
    );
  });

  it("an API entry's path, the identity mount's path, an undeclared path and params that fail their schema are refused", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom("/api/items", "/api/items/", "/api/auth", "/api/auth/sign-in/email"),
          fc
            .stringMatching(/^\/[a-z]{3,8}$/)
            .filter((p) => !["/list", "/signin"].includes(p) && p !== "/items" && p !== "/api"),
          fc.constantFrom("/items/0", "/items/-1", "/items/x", "/items/1.5", "/items/"),
        ),
        (x) => {
          expect(refusedCodes(pageHref(t, x))).toEqual(NOT_A_PAGE);
        },
      ),
      opts,
    );
  });

  it("a guard's `redirect` page is refused, with any query, so a return to it would not loop", () => {
    fc.assert(
      fc.property(fc.option(fc.stringMatching(/^[a-zA-Z0-9]{0,10}$/), { nil: undefined }), (next) => {
        const href = next === undefined ? shop.href("shop.signin") : shop.href("shop.signin", {}, { next });
        expect(matchHref(t, href)?.id).toBe("shop.signin");
        expect(refusedCodes(pageHref(t, href))).toEqual(NOT_A_PAGE);
      }),
      opts,
    );
  });

  it("for any string, the answer is `err` or an `Href` that `matchHref` matches to a page of `t` that is not a guard's redirect page, with no backslash, control character, leading `//` or scheme", () => {
    const piece = fc.constantFrom(
      "/",
      "//",
      "\\",
      "%2F",
      "%2f",
      "%5C",
      "%5c",
      "..",
      ".",
      "%2e",
      "%2E",
      "?",
      "#",
      "&",
      "=",
      "list",
      "items",
      "7",
      "0",
      "signin",
      "api",
      "auth",
      "tab",
      "a",
      "b",
      "\t",
      "\n",
      "\u007f",
      "\u0085",
      "\u0000",
      "https:",
      "javascript:",
      "evil.example",
      "%",
      "é",
      " ",
    );
    const text = fc.oneof(
      fc.string(),
      fc.fullUnicodeString(),
      fc.array(piece, { maxLength: 12 }).map((p) => p.join("")),
      fc.array(piece, { maxLength: 12 }).map((p) => `/${p.join("")}`),
      fc.array(piece, { maxLength: 6 }).map((p) => `/list?${p.join("")}`),
      fc.array(piece, { maxLength: 6 }).map((p) => `/items/${p.join("")}`),
      fc.constantFrom(...hostile),
    );
    fc.assert(
      fc.property(text, (x) => {
        const r = pageHref(t, x);
        if (!r.ok) {
          expect(r.error.code).toBe("keel.notFound");
          expect(r.error.message).toBe("not a page");
          return;
        }
        const v: string = r.value;
        const m = matchHref(t, r.value);
        expect(m).not.toBeNull();
        expect(["shop.list", "shop.item"]).toContain(m?.id);
        expect(v.startsWith("/")).toBe(true);
        expect(v.startsWith("//")).toBe(false);
        expect(v.includes("\\")).toBe(false);
        expect(CONTROL.test(v)).toBe(false);
        expect(SCHEME.test(v)).toBe(false);
        expect(v.includes("#")).toBe(false);
        expect(v.length).toBeLessThanOrEqual(2048);
      }),
      { seed: SEED, numRuns: 2000 },
    );
  });

  it("the accepted answer is rebuilt by the page's contract `href` from the match: declared search keys that parse survive, other keys and the hash drop", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("a", "b", "zzz", ""),
        fc.stringMatching(/^[a-z]{1,6}$/).filter((k) => k !== "tab"),
        fc.integer({ min: 1, max: 1_000_000 }),
        (tab, key, id) => {
          const r = pageHref(t, `/list?${key}=1&tab=${tab}#frag`);
          expect(r).toEqual({
            ok: true,
            value: tab === "a" || tab === "b" ? shop.href("shop.list", {}, { tab }) : "/list",
          });
          const item = pageHref(t, `/items/${id}?${key}=1#frag`);
          expect(item).toEqual({ ok: true, value: shop.href("shop.item", { id }) });
        },
      ),
      opts,
    );
  });
});
