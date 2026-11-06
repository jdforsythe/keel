// Exact-output tests for toJsonSchema (mutation killers).
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { toJsonSchema } from "../src/internal/toJsonSchema.ts";

describe("toJsonSchema exact output", () => {
  it("string bounds appear only when set (min > 0, max defined)", () => {
    expect(toJsonSchema(s.string().node)).toStrictEqual({ type: "string" });
    expect(toJsonSchema(s.string({ min: 0 }).node)).toStrictEqual({ type: "string" });
    expect(toJsonSchema(s.string({ min: 1 }).node)).toStrictEqual({ type: "string", minLength: 1 });
    expect(toJsonSchema(s.string({ min: 2, max: 5 }).node)).toStrictEqual({
      type: "string",
      minLength: 2,
      maxLength: 5,
    });
    expect(toJsonSchema(s.string({ max: 0 }).node)).toStrictEqual({ type: "string", maxLength: 0 });
    expect(toJsonSchema(s.string({ max: 7 }).node)).toStrictEqual({ type: "string", maxLength: 7 });
  });

  it("primitives", () => {
    expect(toJsonSchema(s.number().node)).toStrictEqual({ type: "number" });
    expect(toJsonSchema(s.int().node)).toStrictEqual({ type: "integer" });
    expect(toJsonSchema(s.boolean().node)).toStrictEqual({ type: "boolean" });
    expect(toJsonSchema(s.json().node)).toStrictEqual({});
    expect(toJsonSchema(s.id("user").node)).toStrictEqual({ type: "string" });
  });

  it("literal and enum", () => {
    expect(toJsonSchema(s.literal("a").node)).toStrictEqual({ const: "a" });
    expect(toJsonSchema(s.literal(3).node)).toStrictEqual({ const: 3 });
    expect(toJsonSchema(s.literal(false).node)).toStrictEqual({ const: false });
    expect(toJsonSchema(s.enum(["x", "y"]).node)).toStrictEqual({ type: "string", enum: ["x", "y"] });
  });

  it("object: properties, required excludes optional only, closed", () => {
    const node = s.object({
      a: s.string(),
      b: s.int().optional(),
      c: s.boolean().nullable(),
    }).node;
    expect(toJsonSchema(node)).toStrictEqual({
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: "integer" },
        c: { anyOf: [{ type: "boolean" }, { type: "null" }] },
      },
      required: ["a", "c"],
      additionalProperties: false,
    });
    expect(toJsonSchema(s.object({}).node)).toStrictEqual({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    });
    expect(toJsonSchema(s.object({ a: s.int().optional() }).node)).toStrictEqual({
      type: "object",
      properties: { a: { type: "integer" } },
      required: [],
      additionalProperties: false,
    });
  });

  it("array, record, union, nullable, optional", () => {
    expect(toJsonSchema(s.array(s.int()).node)).toStrictEqual({ type: "array", items: { type: "integer" } });
    expect(toJsonSchema(s.record(s.number()).node)).toStrictEqual({
      type: "object",
      additionalProperties: { type: "number" },
    });
    const u = s.union("t", [s.object({ t: s.literal("a") }), s.object({ t: s.literal("b"), n: s.int() })]);
    expect(toJsonSchema(u.node)).toStrictEqual({
      oneOf: [
        { type: "object", properties: { t: { const: "a" } }, required: ["t"], additionalProperties: false },
        {
          type: "object",
          properties: { t: { const: "b" }, n: { type: "integer" } },
          required: ["t", "n"],
          additionalProperties: false,
        },
      ],
    });
    expect(toJsonSchema(s.string().nullable().node)).toStrictEqual({ anyOf: [{ type: "string" }, { type: "null" }] });
    expect(toJsonSchema(s.string().optional().node)).toStrictEqual({ type: "string" });
  });
});
