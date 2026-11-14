import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { store, stores, transaction } from "../src/index.ts";
import { storeShapes } from "../src/internal/index.ts";

describe("storeShapes (@keel/store/internal)", () => {
  it("lists each store a factory creates with its state and payload schemas, and leaves no store registered", () => {
    const State = s.object({ a: s.string() });
    const Add = s.object({ n: s.int() });
    const factory = () => {
      const st = store(State, { a: "" }, { id: "shape.a" });
      const other = store(s.object({}), {}, { id: "shape.b" });
      return { st, other, add: transaction(st, "shape.add", Add, (x) => x) };
    };
    const shapes = storeShapes(factory);
    expect(shapes.map((x) => x.id)).toEqual(["shape.a", "shape.b"]);
    expect(shapes[0]?.state).toBe(State);
    expect(shapes[0]?.transactions).toEqual({ "shape.add": Add });
    expect(shapes[1]?.transactions).toEqual({});
    expect(storeShapes(factory).map((x) => x.id)).toEqual(["shape.a", "shape.b"]);
    expect([...stores().keys()].filter((k) => k.startsWith("shape."))).toEqual([]);
  });
});
