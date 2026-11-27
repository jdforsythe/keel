import { canonicalJson, hashOf } from "@keel/compiler/internal";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type SourceFile, check } from "../src/index.ts";
import { applyPatch } from "./support/applyPatch.ts";

const SEED = 1337;
const f = (path: string, source: string): SourceFile => ({ path, source });

/** Where the state schema holds the `TodoList` object: at the top, as array items, as record values, or in a nullable array. */
type Nest = "top" | "array" | "record" | "nullable";
const listSchema = (required: readonly string[]) => ({
  type: "object",
  properties: { id: { type: "string" }, hidden: { type: "boolean" } },
  required,
  additionalProperties: false,
});
const stateSchema = (nest: Nest, required: readonly string[]) => {
  const list = listSchema(required);
  const value =
    nest === "array"
      ? { type: "array", items: list }
      : nest === "nullable"
        ? { anyOf: [{ type: "array", items: list }, { type: "null" }] }
        : nest === "record"
          ? { type: "object", additionalProperties: list }
          : list;
  return { type: "object", properties: { lists: value }, required: ["lists"], additionalProperties: false };
};
const WRAP: Record<Nest, string> = {
  top: "TodoList",
  array: "s.array(TodoList)",
  record: "s.record(TodoList)",
  nullable: "s.array(TodoList).nullable()",
};
const HEAD = "import { s } from '@keel/schema'\nimport { store } from '@keel/store'\n";
const boardTs = (nest: Nest, hidden: string) =>
  f(
    "modules/api/board.ts",
    `${HEAD}const TodoList = s.object({ id: s.string(), hidden: ${hidden} }, { closed: true })\n` +
      `export const board = () => store(s.object({ lists: ${WRAP[nest]} }, { closed: true }), { lists: [] }, { id: 'api.board' })\n`,
  );
const data = (state: unknown) => ({
  version: 3,
  contracts: {},
  stores: { "api.board": { state, transactions: {} } },
});
const surface = (d: unknown) => f(".keel/surface.json", `${canonicalJson({ data: d, hash: hashOf(d) })}\n`);
const run = (files: SourceFile[], base: unknown) =>
  check(files, { types: false, base }).diagnostics.filter((d) => /^E(1563|1005)$/.test(d.code));

describe("E1563 fix", () => {
  it("an optional field made required is one E1563 whose fix restores the optional and leaves none", () => {
    fc.assert(
      fc.property(fc.constantFrom<Nest>("top", "array", "record", "nullable"), (nest) => {
        const base = data(stateSchema(nest, ["id"]));
        const now = boardTs(nest, "s.boolean()");
        const d = run([now, surface(data(stateSchema(nest, ["id", "hidden"])))], base);
        expect(d.map((x) => x.code)).toEqual(["E1563"]);
        expect(d[0]?.message).toContain("hidden");
        expect(typeof d[0]?.fix).toBe("string");
        const fixed = applyPatch(now.path, now.source, d[0]?.fix ?? "");
        expect(fixed).toContain("hidden: s.boolean().optional()");
        const after = f(now.path, fixed);
        expect(run([after, surface(data(stateSchema(nest, ["id"])))], base)).toEqual([]);
      }),
      { seed: SEED, numRuns: 8 },
    );
  });
});
