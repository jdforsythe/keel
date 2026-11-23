// The small pure helpers under src/internal: an href written back from params and search, a `keel session` diag, a
// route's decoded params, a reader command's headers, the empty session, and the splitters of module paths and
// `redact` entries.
// Seed 1337
import { createHash } from "node:crypto";
import { type Id, type JsonValue, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { Session } from "../../src/Session.schema.ts";
import { decoded } from "../../src/internal/decoded.ts";
import { emptySession } from "../../src/internal/emptySession.ts";
import { fingerprint } from "../../src/internal/fingerprint.ts";
import { getJson } from "../../src/internal/getJson.ts";
import { hrefOf } from "../../src/internal/hrefOf.ts";
import { moduleFile } from "../../src/internal/moduleFile.ts";
import { objectOf } from "../../src/internal/objectOf.ts";
import { parseRedactEntry } from "../../src/internal/parseRedactEntry.ts";
import { readerHeaders } from "../../src/internal/readerHeaders.ts";
import { sessionDiag } from "../../src/internal/sessionDiag.ts";

const hex12 = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 12);

describe("hrefOf", () => {
  test("fills each :name segment, URL-encoded; a string as is, another value as JSON, a missing one as empty", () => {
    expect(hrefOf("/lists/:listId/items/:n", { listId: "a b/c", n: 7 }, {})).toBe("/lists/a%20b%2Fc/items/7");
    expect(hrefOf("/x/:flag/:obj", { flag: true, obj: { a: 1 } }, {})).toBe("/x/true/%7B%22a%22%3A1%7D");
    expect(hrefOf("/x/:gone/y", {}, {})).toBe("/x//y");
    expect(hrefOf("/x/:_a1/:b_2", { _a1: "p", b_2: "q" }, {})).toBe("/x/p/q");
    expect(hrefOf("/plain", { plain: "no" }, {})).toBe("/plain");
  });

  test("a name stops at the first character that is no letter, digit or underscore", () => {
    expect(hrefOf("/:id.json", { id: "a", "id.json": "no" }, {})).toBe("/a.json");
    expect(hrefOf("/:a-:b", { a: "1", b: "2" }, {})).toBe("/1-2");
    expect(hrefOf("/:1x", { "1x": "no", x: "no" }, {})).toBe("/:1x");
  });

  test("search keys are sorted; null and missing values are left out; an array repeats its key", () => {
    expect(hrefOf("/s", {}, { q: "a b", page: 2, done: false })).toBe("/s?done=false&page=2&q=a+b");
    expect(hrefOf("/s", {}, { b: null, a: "1" })).toBe("/s?a=1");
    expect(hrefOf("/s", {}, { tag: ["x", "y", 3], a: [] })).toBe("/s?tag=x&tag=y&tag=3");
    expect(hrefOf("/s", {}, { o: { k: 1 } })).toBe("/s?o=%7B%22k%22%3A1%7D");
    expect(hrefOf("/s", {}, { empty: "" })).toBe("/s?empty=");
  });

  test("no search, or only null values, leaves the path with no '?'", () => {
    expect(hrefOf("/s", {}, {})).toBe("/s");
    expect(hrefOf("/s/:id", { id: "1" }, { a: null })).toBe("/s/1");
  });

  test("property: the filled path and the query parse back to the params and search given", () => {
    const word = fc.stringMatching(/^[a-z]{1,6}$/);
    fc.assert(
      fc.property(fc.string(), fc.dictionary(word, fc.string(), { maxKeys: 4 }), (id, search) => {
        const url = new URL(hrefOf("/items/:id", { id }, search), "http://app.test");
        expect(decodeURIComponent(url.pathname.slice("/items/".length))).toBe(id);
        expect([...url.searchParams.keys()]).toEqual(Object.keys(search).sort());
        for (const [k, v] of Object.entries(search)) expect(url.searchParams.get(k)).toBe(v);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});

describe("sessionDiag", () => {
  test("a diag at a file is at 1:1; with no file it carries no position", () => {
    expect(sessionDiag("E2002", "session file fails", "sessions/a.json")).toEqual({
      kind: "diag",
      code: "E2002",
      path: "sessions/a.json",
      line: 1,
      col: 1,
      message: "session file fails",
      see: "std.sessions",
    });
    expect(sessionDiag("I1055", "needs a network")).toEqual({
      kind: "diag",
      code: "I1055",
      message: "needs a network",
      see: "k.cli",
    });
  });

  test("`see` is std.monitor for E2010, std.sessions for another E20xx, k.cli otherwise", () => {
    const see = (code: string): unknown => sessionDiag(code, "m").see;
    expect(see("E2010")).toBe("std.monitor");
    expect(see("E2001")).toBe("std.sessions");
    expect(see("E2004")).toBe("std.sessions");
    expect(see("E1056")).toBe("k.cli");
    expect(see("E1052")).toBe("k.cli");
    expect(see("I1055")).toBe("k.cli");
    expect(see("XE20")).toBe("k.cli");
    expect(see("")).toBe("k.cli");
  });

  test("a message of 89 characters is whole; a longer one is its first 86 and '...'", () => {
    expect(sessionDiag("E2003", "m".repeat(89)).message).toBe("m".repeat(89));
    expect(sessionDiag("E2003", `${"a".repeat(86)}bcde`).message).toBe(`${"a".repeat(86)}...`);
    expect(sessionDiag("E2003", "").message).toBe("");
  });

  test("property: the message is the given one or 89 characters ending in '...'", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (message) => {
        const text = String(sessionDiag("E2003", message).message);
        if (message.length <= 89) expect(text).toBe(message);
        else expect(text).toBe(`${message.slice(0, 86)}...`);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});

describe("decoded", () => {
  const Params = s.object({ n: s.int(), tag: s.string().optional() });

  test("with no schema the raw value comes back itself", () => {
    const raw = { n: "1" };
    expect(decoded(undefined, raw)).toBe(raw);
  });

  test("a value the schema parses comes back as a copy of the parsed value", () => {
    const raw = { n: 1, tag: "a" };
    const out = decoded(Params, raw);
    expect(out).toEqual({ n: 1, tag: "a" });
    expect(out).not.toBe(raw);
  });

  test("a value the schema refuses comes back raw", () => {
    const raw = { n: "many" };
    expect(decoded(Params, raw)).toBe(raw);
  });
});

describe("readerHeaders", () => {
  test("accept only, with no token or an empty one", () => {
    expect(readerHeaders({ cwd: "/p" }, "https://s.test")).toEqual({ accept: "application/json" });
    expect(readerHeaders({ cwd: "/p", env: {} }, "https://s.test")).toEqual({ accept: "application/json" });
    expect(readerHeaders({ cwd: "/p", env: { KEEL_SESSIONS_TOKEN: "" } }, "https://s.test")).toEqual({
      accept: "application/json",
    });
  });

  test("the token is the caller cookie: __Host-keel-caller on https, keel-caller otherwise", () => {
    const env = { KEEL_SESSIONS_TOKEN: "t0ken" };
    expect(readerHeaders({ cwd: "/p", env }, "https://s.test")).toEqual({
      accept: "application/json",
      cookie: "__Host-keel-caller=t0ken",
    });
    expect(readerHeaders({ cwd: "/p", env }, "http://localhost:4200")).toEqual({
      accept: "application/json",
      cookie: "keel-caller=t0ken",
    });
    expect(readerHeaders({ cwd: "/p", env }, "http://https:").cookie).toBe("keel-caller=t0ken");
  });
});

describe("emptySession", () => {
  const made = s.id("Session").parse("s1");
  if (!made.ok) throw new Error("s1 is a Session id");
  const id: Id<"Session"> = made.value;

  test("is a valid session with no route, state, events or error, and the fingerprint of no error on no route", () => {
    const made = emptySession(id, 7, 42);
    expect(made).toEqual({
      v: 1,
      id,
      seed: 7,
      deterministic: true,
      at: 42,
      route: { id: "", params: {}, search: {} },
      state: {},
      events: [],
      error: null,
      fingerprint: hex12("\n\n"),
    });
    expect(Session.parse(made).ok).toBe(true);
  });

  test("without a seed it has no seed key and is not deterministic", () => {
    const made = emptySession(id, undefined, 0);
    expect("seed" in made).toBe(false);
    expect(made.deterministic).toBe(false);
    expect(emptySession(id, 0, 0).seed).toBe(0);
    expect(emptySession(id, 0, 0).deterministic).toBe(true);
  });
});

describe("fingerprint", () => {
  test("12 hex of sha256 over code, data.at when it is a string, and the route id, joined by newlines", () => {
    expect(fingerprint(null, "cart.show")).toBe(hex12("\n\ncart.show"));
    expect(fingerprint({ code: "cart.full", message: "m", data: { at: "cart.add" } }, "cart.show")).toBe(
      hex12("cart.full\ncart.add\ncart.show"),
    );
    const others: JsonValue[] = [null, "at", 5, ["at"], {}, { at: 5 }, { at: null }, { other: "x" }];
    for (const data of others)
      expect(fingerprint({ code: "cart.full", message: "m", data }, "r")).toBe(hex12("cart.full\n\nr"));
    expect(fingerprint({ code: "c", message: "one", data: null }, "r")).toBe(
      fingerprint({ code: "c", message: "two", data: null }, "r"),
    );
  });
});

describe("objectOf", () => {
  test("a JSON object comes back as a copy; anything else is {}", () => {
    const value = { a: 1, b: [2] };
    expect(objectOf(value)).toEqual(value);
    expect(objectOf(value)).not.toBe(value);
    for (const other of [null, "s", 5, true, [1, 2], []]) expect(objectOf(other)).toEqual({});
  });
});

describe("moduleFile", () => {
  test("splits <prefix>modules/<id>/<rest>", () => {
    expect(moduleFile("modules/cart/module.ts")).toEqual({ prefix: "", id: "cart", rest: "module.ts" });
    expect(moduleFile("apps/shop/modules/cart/test/a.test.ts")).toEqual({
      prefix: "apps/shop/",
      id: "cart",
      rest: "test/a.test.ts",
    });
    expect(moduleFile("a/modules/b/modules/c/d.ts")).toEqual({ prefix: "a/modules/b/", id: "c", rest: "d.ts" });
  });

  test("a path that is not a file under a module folder is undefined", () => {
    for (const p of ["", "modules", "modules/cart", "modules/cart/", "modules//x.ts", "src/cart/module.ts"])
      expect(moduleFile(p), p).toBeUndefined();
    expect(moduleFile("xmodules/cart/module.ts")).toBeUndefined();
    expect(moduleFile("modules/cart/module.ts\nmodules/x/y.ts")).toBeUndefined();
  });
});

describe("parseRedactEntry", () => {
  test("splits <subject>:<target>#<path> at the first ':' and the first '#'", () => {
    expect(parseRedactEntry("tx:cart.pay#card.number")).toEqual({
      subject: "tx",
      target: "cart.pay",
      path: "card.number",
    });
    expect(parseRedactEntry("store:a:b#c#d")).toEqual({ subject: "store", target: "a:b", path: "c#d" });
    expect(parseRedactEntry(":t#p")).toEqual({ subject: "", target: "t", path: "p" });
  });

  test("no ':', no '#', an empty target or an empty path is undefined", () => {
    for (const entry of ["", "tx", "tx:cart.pay", "tx#card", "tx:#card", "tx:cart.pay#", "a#b:c#d"])
      expect(parseRedactEntry(entry), entry).toBeUndefined();
  });
});

describe("getJson", () => {
  const io = (fetch: (url: string, init?: RequestInit) => Promise<Response>) => ({ cwd: "/p", fetch });

  test("a 2xx JSON answer is its body, and the url and init reach fetch", async () => {
    const seen: unknown[] = [];
    const init = { headers: { accept: "application/json" } };
    const r = await getJson(
      io(async (url, given) => {
        seen.push(url, given);
        return new Response('{"a":1}');
      }),
      "http://s.test/x",
      init,
    );
    expect(r).toEqual({ ok: true, body: { a: 1 } });
    expect(seen).toEqual(["http://s.test/x", init]);
  });

  test("a throwing fetch, a non-2xx status and a body that is not JSON each give their reason", async () => {
    expect(
      await getJson(
        io(() => Promise.reject(new Error("down"))),
        "http://s.test",
      ),
    ).toEqual({
      ok: false,
      why: "target unreachable",
    });
    expect(
      await getJson(
        io(async () => new Response("{}", { status: 503 })),
        "http://s.test",
      ),
    ).toEqual({
      ok: false,
      why: "target answered 503",
    });
    expect(
      await getJson(
        io(async () => new Response("<html>")),
        "http://s.test",
      ),
    ).toEqual({
      ok: false,
      why: "not JSON",
    });
  });
});
