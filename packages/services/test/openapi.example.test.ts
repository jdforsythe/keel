// Examples: the OpenAPI generator's schema mapping, endpoint layout and subset errors (k.services OpenAPI, rfc:0034).
import { type Schema, s } from "@keel/schema";
import { describe, expect, test } from "vitest";
import { endpoints } from "../src/endpoints.ts";
import { openapi } from "../src/openapi/openapi.ts";

const SERVER = [{ url: "https://api.test/v1" }];
const doc = (paths: unknown, extra: Record<string, unknown> = {}) => ({
  openapi: "3.1.0",
  servers: SERVER,
  paths,
  ...extra,
});
const one = (schema: unknown, extra: Record<string, unknown> = {}) =>
  doc(
    { "/x": { get: { operationId: "x", responses: { "200": { content: { "application/json": { schema } } } } } } },
    extra,
  );

/** The generated `schema` file with its imports dropped, so its declaration can be evaluated with `s` in scope. */
function evaluate(source: string): Readonly<Record<string, { readonly output: Schema<unknown> }>> {
  const body = source
    .split("\n")
    .filter((l) => !l.startsWith("import ") && !l.startsWith("//"))
    .join("\n")
    .replace(/export const \w+ = /, "return ");
  return new Function("s", "endpoints", body)(s, endpoints);
}

/** Generated layout folded to one line: `s.object({ a: s.string() })` whatever the line breaks. */
function flatten(src: string): string {
  return src
    .replace(/\n\s*/g, " ")
    .replace(/,\s*([}\])])/g, " $1")
    .replace(/([[(]) /g, "$1")
    .replace(/ ([\])])/g, "$1")
    .replace(/ \./g, ".");
}

function outputOf(schema: unknown, extra: Record<string, unknown> = {}): string {
  const r = openapi(one(schema, extra), { name: "x" });
  if (!r.ok) throw new Error(JSON.stringify(r.error.data.issues));
  const block = r.value.schema.slice(
    r.value.schema.indexOf("    output: ") + 12,
    r.value.schema.lastIndexOf("\n  },\n});"),
  );
  return flatten(block.replace(/,$/, ""));
}

describe("schema mapping", () => {
  test.each([
    [{ type: "string" }, "s.string()"],
    [{ type: "string", minLength: 1, maxLength: 9 }, "s.string({ min: 1, max: 9 })"],
    [{ type: "integer", minimum: 0 }, "s.int({ min: 0 })"],
    [{ type: "number", maximum: 2.5 }, "s.number({ max: 2.5 })"],
    [{ type: "boolean" }, "s.boolean()"],
    [{ type: "string", enum: ["a", "b"] }, 's.enum(["a", "b"])'],
    [{ enum: ["a", null] }, 's.enum(["a"]).nullable()'],
    [{ enum: [1, 2] }, "s.json()"],
    [{ const: "k" }, 's.literal("k")'],
    [{ const: 3 }, "s.literal(3)"],
    [{ type: "string", nullable: true }, "s.string().nullable()"],
    [{ type: ["integer", "null"] }, "s.int().nullable()"],
    [{ type: ["integer", "string"] }, "s.json()"],
    [{ type: "array", items: { type: "string" } }, "s.array(s.string())"],
    [{ type: "array" }, "s.array(s.json())"],
    [
      { type: "object", properties: { a: { type: "string" }, "b-c": { type: "integer" } }, required: ["a"] },
      's.object({ a: s.string(), "b-c": s.int().optional() })',
    ],
    [
      { properties: { a: { type: "boolean" } }, required: ["a"], additionalProperties: false },
      "s.object({ a: s.boolean() }, { closed: true })",
    ],
    [{ type: "object", additionalProperties: false }, "s.object({}, { closed: true })"],
    [{ type: "object", additionalProperties: { type: "number" } }, "s.record(s.number())"],
    [{ type: "object" }, "s.record(s.json())"],
    [{ oneOf: [{ type: "string" }, { type: "integer" }] }, "s.union([s.string(), s.int()])"],
    [{ anyOf: [{ type: "string" }] }, "s.string()"],
    [{ allOf: [{ type: "string" }] }, "s.json()"],
    [{ type: "null", nullable: true }, "s.json()"],
    [true, "s.json()"],
  ])("%j -> %s", (schema, expected) => {
    expect(outputOf(schema)).toBe(expected);
  });

  test("component refs are local consts, dependencies first; other local refs and reserved names are inlined", () => {
    const components = {
      schemas: {
        A: { type: "object", properties: { b: { $ref: "#/components/schemas/B" } }, required: ["b"] },
        B: { $ref: "#/components/schemas/C" },
        "C/D": { type: "string" },
        C: { $ref: "#/components/schemas/C~1D" },
        default: { type: "boolean" },
        s: { type: "integer" },
      },
    };
    const r = openapi(one({ $ref: "#/components/schemas/A" }, { components }), { name: "x" });
    expect(r.ok && r.value.schema.split("\n").slice(4, 11)).toEqual([
      "const C = s.string();",
      "const B = C;",
      "const A = s.object({",
      "  b: B,",
      "});",
      "",
      "export const XApi = endpoints({",
    ]);
    expect(outputOf({ $ref: "#/components/schemas/A" }, { components })).toBe("A");
    expect(outputOf({ $ref: "#/components/schemas/default" }, { components })).toBe("s.boolean()");
    expect(outputOf({ $ref: "#/components/schemas/s" }, { components })).toBe("s.int()");
    expect(outputOf({ $ref: "#/components/schemas/XApi" }, { components: { schemas: { XApi: {} } } })).toBe("s.json()");
  });

  test("the generated declaration evaluates and its schemas parse what the OpenAPI schema describes", () => {
    const r = openapi(
      one(
        { $ref: "#/components/schemas/T" },
        {
          components: {
            schemas: {
              T: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  n: { type: "integer", minimum: 1 },
                  tag: { $ref: "#/components/schemas/Tag" },
                },
                required: ["id", "n"],
              },
              Tag: { enum: ["a", "b"] },
            },
          },
        },
      ),
      { name: "x" },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = evaluate(r.value.schema).x?.output;
    expect(out?.parse({ id: "1", n: 2, tag: "a" }).ok).toBe(true);
    expect(out?.parse({ id: "1", n: 0 }).ok).toBe(false);
    expect(out?.parse({ id: "1", n: 2, tag: "c" }).ok).toBe(false);
  });
});

describe("endpoints", () => {
  const full = doc({
    "/orders/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      get: {
        operationId: "getOrder",
        parameters: [
          { name: "tab", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", required: true, schema: { type: "integer" } },
          { name: "x-trace", in: "header", schema: { type: "string" } },
          { $ref: "#/components/parameters/Q" },
        ],
        responses: {
          "404": { content: { "application/json": { schema: { type: "string" } } } },
          "201": { content: { "application/json": { schema: { type: "boolean" } } } },
          "200": { $ref: "#/components/responses/Ok" },
          "500": { description: "no body" },
          default: { content: { "application/json": { schema: { type: "number" } } } },
        },
      },
      delete: { operationId: "removeOrder", responses: { "204": { description: "gone" } } },
      options: { operationId: "ignored", responses: {} },
    },
    "/files/{name}/{rev}": {
      put: {
        operationId: "putFile",
        parameters: [{ name: "stray", in: "path", schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { type: "string" } } } },
        responses: {},
      },
      post: { operationId: "postForm", requestBody: { content: { "text/plain": {} } }, responses: {} },
    },
  });
  const components = {
    parameters: { Q: { name: "q", in: "query", schema: { type: "boolean" } } },
    responses: { Ok: { content: { "application/json": { schema: { type: "string" } } } } },
  };

  test("one declaration per operation in document order, with the files' exact layout", () => {
    const r = openapi({ ...full, components }, { name: "order-items" });
    expect(r).toEqual({
      ok: true,
      value: {
        schema: `// Generated from OpenAPI by \`keel scaffold service\` (k.services); do not edit.
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";

export const OrderItemsApi = endpoints({
  getOrder: {
    method: "GET",
    path: "/orders/:id",
    params: s.object({
      id: s.int(),
    }),
    query: s.object({
      tab: s.string().optional(),
      page: s.int(),
      q: s.boolean().optional(),
    }),
    output: s.string(),
    errors: {
      404: s.string(),
    },
  },
  removeOrder: {
    method: "DELETE",
    path: "/orders/:id",
    params: s.object({
      id: s.int(),
    }),
    output: s.json(),
  },
  putFile: {
    method: "PUT",
    path: "/files/:name/:rev",
    params: s.object({
      name: s.string(),
      rev: s.string(),
    }),
    body: s.string(),
    output: s.json(),
  },
  postForm: {
    method: "POST",
    path: "/files/:name/:rev",
    params: s.object({
      name: s.string(),
      rev: s.string(),
    }),
    output: s.json(),
  },
});
`,
        service: `// Generated from OpenAPI by \`keel scaffold service\` (k.services); do not edit.
import { service } from "@keel/services";
import { OrderItemsApi } from "./api.schema.ts";

export const api = service({ base: "https://api.test/v1", schema: OrderItemsApi });
`,
      },
    });
  });
});

describe("subset errors", () => {
  const issues = (d: unknown) => {
    const r = openapi(d, { name: "x" });
    return r.ok ? [] : r.error.data.issues;
  };
  const get = (op: Record<string, unknown>) => doc({ "/x": { get: { responses: {}, ...op } } });

  test("each problem is one issue at its path, with code schema.invalid", () => {
    const r = openapi(42, { name: "x" });
    expect(r.ok ? undefined : r.error.code).toBe("schema.invalid");
    expect(issues(42)).toEqual([{ path: [], rule: "type" }]);
    expect(issues({ openapi: "3.0.0", servers: SERVER })).toEqual([{ path: ["paths"], rule: "required" }]);
    expect(issues({ ...doc({}), openapi: "2.0" })).toEqual([{ path: ["openapi"], rule: "literal" }]);
    expect(issues({ ...doc({}), openapi: undefined })).toEqual([{ path: ["openapi"], rule: "required" }]);
    expect(issues({ ...doc({}), servers: undefined })).toEqual([{ path: ["servers", 0, "url"], rule: "required" }]);
    expect(issues({ ...doc({}), servers: [{ url: "/v1" }] })).toEqual([{ path: ["servers", 0, "url"], rule: "type" }]);
    expect(issues(get({}))).toEqual([{ path: ["paths", "/x", "get", "operationId"], rule: "required" }]);
    expect(issues(get({ operationId: "a-b" }))).toEqual([
      { path: ["paths", "/x", "get", "operationId"], rule: "type" },
    ]);
    expect(issues(doc({ "/x": { get: 1 } }))).toEqual([
      { path: ["paths", "/x", "get", "operationId"], rule: "required" },
    ]);
    expect(issues(doc({ x: { get: { operationId: "a" } } }))).toEqual([{ path: ["paths", "x"], rule: "type" }]);
    expect(
      issues(
        doc({ "/a": { get: { operationId: "a", responses: {} } }, "/b": { get: { operationId: "a", responses: {} } } }),
      ),
    ).toEqual([{ path: ["paths", "/b", "get", "operationId"], rule: "type" }]);
    expect(issues(doc({ "/{a-b}": { get: { operationId: "a", responses: {} } } }))).toEqual([
      { path: ["paths", "/{a-b}"], rule: "type" },
    ]);
    expect(
      issues(get({ operationId: "a", parameters: [{ in: "query" }, { name: "q" }, { $ref: "#/nope" }, 5] })),
    ).toEqual([
      { path: ["paths", "/x", "get", "parameters", 0, "name"], rule: "required" },
      { path: ["paths", "/x", "get", "parameters", 1, "in"], rule: "required" },
      { path: ["paths", "/x", "get", "parameters", 2, "$ref"], rule: "required" },
    ]);
  });

  test("cyclic, remote and missing refs are issues; min above max is an issue", () => {
    const cyc = { schemas: { A: { $ref: "#/components/schemas/B" }, B: { $ref: "#/components/schemas/A" } } };
    const at = ["paths", "/x", "get", "responses", "200", "content", "application/json", "schema", "$ref"];
    expect(issues(one({ $ref: "#/components/schemas/A" }, { components: cyc }))).toEqual([
      { path: ["components", "schemas", "B", "$ref"], rule: "type" },
    ]);
    const self = { schemas: { L: { type: "array", items: { $ref: "#/components/schemas/L" } } } };
    expect(issues(one({ $ref: "#/components/schemas/L" }, { components: self }))).toEqual([
      { path: ["components", "schemas", "L", "items", "$ref"], rule: "type" },
    ]);
    expect(issues(one({ $ref: "#/components/schemas/Gone" }))).toEqual([{ path: at, rule: "required" }]);
    expect(issues(one({ $ref: "#/definitions/A" }, { definitions: { A: { $ref: "#/definitions/A" } } }))).toEqual([
      { path: at, rule: "type" },
    ]);
    expect(issues(one({ $ref: "other.json#/A" }))).toEqual([{ path: at, rule: "type" }]);
    expect(issues(one({ $ref: "#/components/schemas/Z" }))).toEqual([{ path: at, rule: "required" }]);
    expect(issues(one({ type: "integer", minimum: 3, maximum: 1 }))).toEqual([
      { path: [...at.slice(0, -1), "minimum"], rule: "max" },
    ]);
  });

  test("a name that is not a module id throws", () => {
    expect(() => openapi(doc({}), { name: "" })).toThrow(RangeError);
    expect(() => openapi(doc({}), { name: "1x" })).toThrow(RangeError);
    expect(openapi(doc({}), { name: "x" }).ok).toBe(true);
  });
});

test("a recursive object schema reached twice on separate branches is not a cycle", () => {
  const components = { schemas: { S: { type: "string" } } };
  const schema = {
    type: "object",
    properties: { a: { $ref: "#/components/schemas/S" }, b: { $ref: "#/components/schemas/S" } },
    required: ["a", "b"],
  };
  expect(outputOf(schema, { components })).toBe("s.object({ a: S, b: S })");
  void s;
});
