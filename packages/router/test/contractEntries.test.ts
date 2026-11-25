// k.contract entries: what `contract` refuses, by code and message, and what a declared API entry keeps (its query,
// body, errors, timeout and events) for the server that answers it.
import { ok, s } from "@keel/schema";
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { action } from "../src/action.ts";
import { contract } from "../src/contract/contract.ts";
import { compileRoutes } from "../src/internal/compileRoutes.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";

const SEED = 1337;
const Out = s.object({});
const Id = s.object({ id: s.string() });
const Query = s.object({ q: s.string().optional() });
const Body = s.object({ name: s.string() });
const NotFound = s.error("t.notFound", s.object({}));

/** The message `contract("t", { [id]: entry })` throws over an entry its types refuse, or `null`. */
const refusal = (entry: unknown, id = "t.x"): string | null => {
  try {
    Reflect.apply(contract, undefined, ["t", { [id]: entry }]);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return null;
};
const codeOf = (entry: unknown, id = "t.x"): unknown => {
  try {
    Reflect.apply(contract, undefined, ["t", { [id]: entry }]);
  } catch (e) {
    return Reflect.get(Object(e), "code");
  }
  return null;
};
const get = { method: "GET", path: "/api/x", output: Out };

/** A component for a table that renders no page. */
const view = (): Node => {
  throw new Error("no page renders here");
};

describe("an entry of no kind", () => {
  it("E1510 for an entry that is no object", () => {
    for (const e of [null, 7, "x", true, undefined]) {
      expect(refusal(e)).toBe("E1510 t.x: an entry is an object");
      expect(codeOf(e)).toBe("E1510");
    }
  });

  it("E1510 for an object with no path, layout or method", () => {
    const no =
      "E1510 t.x: an entry is a page { path }, a layout { layout: true } or an API entry { method, path, output }";
    expect(refusal({})).toBe(no);
    expect(refusal({ path: 7 })).toBe(no);
    expect(refusal({ output: Out })).toBe(no);
  });
});

describe("a layout entry", () => {
  it("is exactly { layout: true }", () => {
    expect(refusal({ layout: true })).toBeNull();
    for (const v of [false, 1, "true", null, undefined]) {
      expect(refusal({ layout: v })).toBe("E1510 t.x: a layout entry is { layout: true }");
      expect(codeOf({ layout: v })).toBe("E1510");
    }
    expect(refusal({ layout: true, path: "/x" })).toBe('E1510 t.x: a layout entry takes no "path"');
  });
});

describe("a page entry", () => {
  it("takes path, params and search, and no other member", () => {
    expect(refusal({ path: "/x/:id", params: Id, search: Query })).toBeNull();
    for (const k of ["query", "body", "output", "errors", "timeout", "events", "component"])
      expect(refusal({ path: "/x", [k]: Out })).toBe(`E1510 t.x: a page entry takes no "${k}"`);
  });

  it("E1510 for params or search that is no object schema, naming the member", () => {
    fc.assert(
      fc.property(fc.constantFrom("params", "search"), fc.constantFrom(null, 7, "x", {}, s.string()), (k, v) => {
        expect(refusal({ path: "/x", [k]: v })).toBe(`E1510 t.x: "${k}" is no object schema`);
        expect(codeOf({ path: "/x", [k]: v })).toBe("E1510");
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("E1504 for a search field that is not optional, naming it", () => {
    expect(refusal({ path: "/x", search: s.object({ q: s.string().optional(), page: s.int() }) })).toBe(
      'E1504 t.x: search field "page" must be optional',
    );
  });

  it("E1503 for a path param without a params field, and a params field not in the path", () => {
    expect(refusal({ path: "/x/:id" })).toBe('E1503 t.x: ":id" has no params field');
    expect(refusal({ path: "/x/:id", params: s.object({ other: s.string(), id: s.string() }) })).toBe(
      'E1503 t.x: params field "other" not in path',
    );
    expect(refusal({ path: "/x", params: Id })).toBe('E1503 t.x: params field "id" not in path');
    expect(refusal({ ...get, path: "/api/:id" })).toBe('E1503 t.x: ":id" has no params field');
  });
});

describe("an API entry", () => {
  it("E1510 for a method that is not one of the five, naming it", () => {
    for (const m of ["HEAD", "OPTIONS", "get", "", 7, null, undefined]) {
      expect(refusal({ ...get, method: m })).toBe(
        `E1510 t.x: method ${String(m)} is not GET, POST, PUT, PATCH or DELETE`,
      );
      expect(codeOf({ ...get, method: m })).toBe("E1510");
    }
  });

  it("E1510 without a path or an output schema", () => {
    expect(refusal({ method: "GET", output: Out })).toBe("E1510 t.x: an API entry needs a path");
    expect(refusal({ method: "GET", path: 7, output: Out })).toBe("E1510 t.x: an API entry needs a path");
    expect(refusal({ method: "GET", path: "/api/x" })).toBe("E1510 t.x: an API entry needs an output schema");
    expect(refusal({ method: "GET", path: "/api/x", output: {} })).toBe(
      "E1510 t.x: an API entry needs an output schema",
    );
  });

  it("E1510 for a member an API entry takes none of", () => {
    for (const k of ["search", "layout", "component", "title"])
      expect(refusal({ ...get, [k]: Query })).toBe(`E1510 t.x: a API entry takes no "${k}"`);
  });

  it("E1510 for params, query or body that is no object schema, naming the member", () => {
    fc.assert(
      fc.property(fc.constantFrom("params", "query", "body"), fc.constantFrom(null, 7, {}, s.string()), (k, v) => {
        expect(refusal({ ...get, method: "POST", [k]: v })).toBe(`E1510 t.x: "${k}" is no object schema`);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("E1510 for errors that do not map a status to a schema", () => {
    const no = 'E1510 t.x: "errors" maps a status to a schema';
    for (const v of [null, 7, "x", true, { 404: 7 }, { 404: NotFound, 500: 7 }, { 404: {}, 500: NotFound }]) {
      expect(refusal({ ...get, errors: v })).toBe(no);
      expect(codeOf({ ...get, errors: v })).toBe("E1510");
    }
    expect(refusal({ ...get, errors: {} })).toBeNull();
    expect(refusal({ ...get, errors: { 404: NotFound } })).toBeNull();
  });

  it("E1510 for a timeout that is no number and events that is no boolean", () => {
    for (const v of ["100", null, true, {}]) {
      expect(refusal({ ...get, timeout: v })).toBe('E1510 t.x: "timeout" is ms');
      expect(codeOf({ ...get, timeout: v })).toBe("E1510");
    }
    for (const v of ["true", null, 1, {}]) {
      expect(refusal({ ...get, events: v })).toBe('E1510 t.x: "events" is a boolean');
      expect(codeOf({ ...get, events: v })).toBe("E1510");
    }
    expect(refusal({ ...get, timeout: fixedTime(100), events: false })).toBeNull();
  });

  it("E1653 for a body on a GET", () => {
    expect(refusal({ ...get, body: Body })).toBe("E1653 t.x: a GET entry has no body");
    expect(codeOf({ ...get, body: Body })).toBe("E1653");
    expect(refusal({ ...get, method: "POST", body: Body })).toBeNull();
  });

  it("E1513 for an API id whose name is not one lowerCamel segment", () => {
    for (const name of ["Read", "re-ad", "a.b", "1a", "a_b", "a b", "Xa", "ab!", "é"]) {
      expect(refusal(get, `t.${name}`)).toBe(`E1513 t.${name}: an API id is t.<name>, name one lowerCamel segment`);
      expect(codeOf(get, `t.${name}`)).toBe("E1513");
    }
    for (const name of ["a", "read", "readAll", "r2D2", "aB"]) expect(refusal(get, `t.${name}`)).toBeNull();
    expect(refusal({ path: "/x" }, "t.Read")).toBeNull();
  });

  it("E1155 for an id that is not of the contract's module", () => {
    expect(refusal(get, "u.x")).toBe("E1155 u.x: a route id of module t is t.<name>");
  });

  it("keeps its params, query, body, errors, timeout and events for the server", () => {
    const c = contract("k", {
      "k.read": {
        method: "GET",
        path: "/api/k/:id",
        params: Id,
        query: Query,
        output: Out,
        timeout: fixedTime(250),
        events: false,
      },
      "k.write": { method: "POST", path: "/api/k/:id", params: Id, body: Body, output: Out, errors: { 404: NotFound } },
      "k.plain": { method: "DELETE", path: "/api/k", output: Out },
      "k.page": { path: "/k/:id", params: Id, search: Query },
    });
    const table = compileRoutes(
      manifest(c, {
        "k.read": { loader: loader(c, "k.read", {}, async () => ok({})) },
        "k.write": { action: action(c, "k.write", {}, async () => ok({})) },
        "k.plain": { action: action(c, "k.plain", {}, async () => ok({})) },
        "k.page": { component: view },
      }),
    ).table;
    const read = table.get("k.read")?.def;
    const write = table.get("k.write")?.def;
    const plain = table.get("k.plain")?.def;
    const page = table.get("k.page")?.def;
    expect([read?.kind, read?.method, read?.path, read?.module, read?.id]).toEqual([
      "api",
      "GET",
      "/api/k/:id",
      "k",
      "k.read",
    ]);
    expect(read?.params).toBe(Id);
    expect(read?.query).toBe(Query);
    expect(read?.output).toBe(Out);
    expect(read?.timeout).toBe(250);
    expect(read?.events).toBe(false);
    expect(read?.body).toBeUndefined();
    expect(read?.errors).toBeUndefined();
    expect(write?.body).toBe(Body);
    expect(write?.params).toBe(Id);
    expect(write?.errors).toEqual({ 404: NotFound });
    expect(write?.errors?.[404]).toBe(NotFound);
    expect(write?.query).toBeUndefined();
    expect(write?.timeout).toBeUndefined();
    expect(write?.events).toBeUndefined();
    expect([plain?.params, plain?.query, plain?.body, plain?.errors, plain?.timeout, plain?.events]).toEqual(
      Array.from({ length: 6 }, () => undefined),
    );
    expect(write?.actions.POST?.input).toBe(Body);
    expect(plain?.actions.DELETE?.input.parse({}).ok).toBe(true);
    expect([page?.kind, page?.path]).toEqual(["page", "/k/:id"]);
    expect(page?.params).toBe(Id);
    expect(page?.search).toBe(Query);
  });
});

describe("a contract loaded afresh", () => {
  it("takes every member of a page and an API entry and checks an API id's name", async () => {
    vi.resetModules();
    const fresh = await import("../src/contract/contract.ts");
    const declare = (id: string, entry: object): string | null => {
      try {
        Reflect.apply(fresh.contract, undefined, ["t", { [id]: entry }]);
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      return null;
    };
    expect(declare("t.page", { path: "/x/:id", params: Id, search: Query })).toBeNull();
    const all = {
      method: "POST",
      path: "/api/x/:id",
      params: Id,
      query: Query,
      body: Body,
      output: Out,
      errors: { 404: NotFound },
      timeout: fixedTime(100),
      events: false,
    };
    expect(declare("t.all", all)).toBeNull();
    for (const name of ["a", "read", "readAll", "r2D2"]) expect(declare(`t.${name}`, get)).toBeNull();
    for (const name of ["Read", "Xa", "a-b", "ab!", "a.b"])
      expect(declare(`t.${name}`, get)).toBe(`E1513 t.${name}: an API id is t.<name>, name one lowerCamel segment`);
    expect(declare("t.x", { ...get, search: Query })).toBe('E1510 t.x: a API entry takes no "search"');
    expect(declare("t.x", { path: "/x", query: Query })).toBe('E1510 t.x: a page entry takes no "query"');
  });
});
