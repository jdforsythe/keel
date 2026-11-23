// @vitest-environment happy-dom
// What a resumed page reads from `#k-state`: stores, islands, the served route, the failed loader's error and the
// rejected form post; and the errors a Boundary's fallback gets. Property seed: 1337.
import { s } from "@keel/schema";
import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { InvalidThrow } from "../src/internal/InvalidThrow.ts";
import { invalidOf } from "../src/internal/invalidOf.ts";
import { readError } from "../src/internal/readError.ts";
import { readForm } from "../src/internal/readForm.ts";
import { readRoute } from "../src/internal/readRoute.ts";
import { readState } from "../src/internal/readState.ts";
import { toCaught } from "../src/internal/toCaught.ts";
import { SEED } from "./support.ts";

afterEach(() => {
  document.body.replaceChildren();
});

const route = { id: "todos.list", path: "/lists/:listId", href: "/lists/l1?q=a", params: { listId: "l1" }, search: {} };
const form = { method: "post", values: { title: "Milk" }, errors: { title: "too short" } };
const notRecords: unknown[] = [undefined, null, "text", 3, true, [], [{}]];

describe("readRoute", () => {
  it("returns the five served fields and nothing else", () => {
    expect(readRoute({ ...route, extra: 1 })).toEqual(route);
  });

  it.each(["id", "path", "href"])("is null when %s is missing or no string", (key) => {
    expect(readRoute({ ...route, [key]: undefined })).toBeNull();
    expect(readRoute({ ...route, [key]: 7 })).toBeNull();
    expect(readRoute({ ...route, [key]: null })).toBeNull();
  });

  it.each(["params", "search"])("is null when %s is no object", (key) => {
    for (const bad of notRecords) expect(readRoute({ ...route, [key]: bad })).toBeNull();
  });

  it("is null for a value that is no object", () => {
    for (const bad of notRecords) expect(readRoute(bad)).toBeNull();
  });
});

describe("readForm", () => {
  it("keeps text values, lists of text and message errors, with the href it was posted to", () => {
    const read = readForm(
      {
        method: "post",
        values: {
          title: "Milk",
          tags: ["a", "b"],
          none: [],
          count: 2,
          mixed: ["a", 1],
          gone: null,
          nested: { a: "b" },
        },
        errors: { title: "too short", count: 2, tags: ["a"], gone: null },
        extra: true,
      },
      "/lists/l1",
    );
    expect(read).toEqual({
      href: "/lists/l1",
      method: "post",
      values: { title: "Milk", tags: ["a", "b"], none: [] },
      errors: { title: "too short" },
    });
  });

  it("any form of the served shape is read whole", () => {
    const text = fc.string();
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.dictionary(text, fc.oneof(text, fc.array(text))),
        fc.dictionary(text, text),
        (href, method, values, errors) => {
          expect(readForm({ method, values, errors }, href)).toEqual({ href, method, values, errors });
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("is null when the method is no string, or values or errors no object", () => {
    expect(readForm({ ...form, method: undefined }, "/a")).toBeNull();
    expect(readForm({ ...form, method: 1 }, "/a")).toBeNull();
    for (const bad of notRecords) {
      expect(readForm({ ...form, values: bad }, "/a")).toBeNull();
      expect(readForm({ ...form, errors: bad }, "/a")).toBeNull();
      expect(readForm(bad, "/a")).toBeNull();
    }
  });
});

describe("readError", () => {
  it("keeps the code and a string data.at; the message is the code", () => {
    expect(readError({ code: "todos.missing", message: "private text", data: { at: "todos.list", id: 7 } })).toEqual({
      code: "todos.missing",
      message: "todos.missing",
      data: { at: "todos.list" },
    });
  });

  it("has empty data when data.at is no string or data no object", () => {
    const bare = { code: "todos.missing", message: "todos.missing", data: {} };
    expect(readError({ code: "todos.missing" })).toEqual(bare);
    expect(readError({ code: "todos.missing", data: {} })).toEqual(bare);
    expect(readError({ code: "todos.missing", data: { at: 7 } })).toEqual(bare);
    for (const bad of notRecords) expect(readError({ code: "todos.missing", data: bad })).toEqual(bare);
  });

  it("is null without a string code", () => {
    expect(readError({ message: "x" })).toBeNull();
    expect(readError({ code: 7 })).toBeNull();
    for (const bad of notRecords) expect(readError(bad)).toBeNull();
  });
});

describe("readState", () => {
  const empty = { stores: {}, islands: {}, route: null, error: null, form: null };
  const page = (json: string | null): { root: Element; warnings: string[] } => {
    const root = document.createElement("main");
    document.body.append(root);
    if (json !== null) {
      const script = document.createElement("script");
      script.type = "application/json";
      script.id = "k-state";
      script.textContent = json;
      root.append(script);
    }
    return { root, warnings: [] };
  };

  it("reads stores, islands, route, error and the form posted to the route's href", () => {
    const { root, warnings } = page(
      JSON.stringify({ stores: { a: 1 }, islands: { i: [2] }, route, error: { code: "todos.missing" }, form }),
    );
    expect(readState(root, warnings)).toEqual({
      stores: { a: 1 },
      islands: { i: [2] },
      route,
      error: { code: "todos.missing", message: "todos.missing", data: {} },
      form: { href: route.href, ...form },
    });
    expect(warnings).toEqual([]);
  });

  it("finds the script elsewhere in the document when the root holds none", () => {
    const { root } = page(JSON.stringify({ stores: { a: 1 } }));
    const island = document.createElement("section");
    document.body.append(island);
    expect(readState(island, []).stores).toEqual({ a: 1 });
    expect(readState(root, []).stores).toEqual({ a: 1 });
  });

  it("the script under the root wins over the document's", () => {
    page(JSON.stringify({ stores: { from: "document" } }));
    const { root } = page(JSON.stringify({ stores: { from: "root" } }));
    expect(readState(root, []).stores).toEqual({ from: "root" });
  });

  it("without a script everything is empty and nothing is warned", () => {
    const { root, warnings } = page(null);
    expect(readState(root, warnings)).toEqual(empty);
    expect(warnings).toEqual([]);
  });

  it("a form without a served route is not read, and misshapen parts are empty", () => {
    const { root, warnings } = page(JSON.stringify({ stores: [1], islands: "x", route: { id: 1 }, error: 3, form }));
    expect(readState(root, warnings)).toEqual(empty);
    expect(warnings).toEqual([]);
  });

  it.each(["", "{not json", "undefined"])("text %j that is not JSON warns and leaves everything empty", (text) => {
    const { root, warnings } = page(text);
    expect(readState(root, warnings)).toEqual(empty);
    expect(warnings).toEqual(["E1253 #k-state is not valid JSON; stores keep their initial state"]);
  });

  it.each(["[1]", "3", "null", '"text"'])("JSON %s that is no object warns and leaves everything empty", (text) => {
    const { root, warnings } = page(text);
    expect(readState(root, warnings)).toEqual(empty);
    expect(warnings).toEqual(["E1253 #k-state is not an object; stores keep their initial state"]);
  });
});

describe("what a Boundary's fallback gets", () => {
  it("invalidOf without a schema error is an empty schema.invalid saying why, at the element", () => {
    expect(invalidOf("todo.title", "the value is not serializable")).toEqual({
      code: "schema.invalid",
      message: "the value is not serializable",
      data: { issues: [], at: "todo.title" },
    });
  });

  it("invalidOf keeps a schema error as the parse returned it and adds the element's id", () => {
    const parsed = s.object({ n: s.int({ min: 0 }) }).parse({ n: -1 });
    if (parsed.ok) throw new Error("expected a schema error");
    const made = invalidOf("todo.count", parsed.error);
    expect(made).toEqual({ ...parsed.error, data: { ...parsed.error.data, at: "todo.count" } });
    expect(made.code).toBe("schema.invalid");
    expect(made.data.issues).toEqual(parsed.error.data.issues);
    expect(made.data.issues.length).toBeGreaterThan(0);
  });

  it("toCaught hands on a host element's schema.invalid unchanged", () => {
    const invalid = invalidOf("todo.title", "bad value");
    expect(toCaught(new InvalidThrow(invalid), "elsewhere")).toBe(invalid);
  });

  it("toCaught makes keel.unexpected at the element, with the error's message when it has one", () => {
    expect(toCaught(new Error("boom"), "todo.save")).toMatchObject({
      code: "keel.unexpected",
      message: "boom",
      data: { at: "todo.save" },
    });
    for (const thrown of [new Error(""), "text", { message: "not an Error" }, null, undefined])
      expect(toCaught(thrown, "todo.save")).toMatchObject({
        code: "keel.unexpected",
        message: "keel.unexpected",
        data: { at: "todo.save" },
      });
  });
});
