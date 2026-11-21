// The undeclared-data scan walks an array by index: an array's own extra properties are not data and are ignored,
// while a prototype key inside an item is reported at its index (k.schema).
import { describe, expect, it } from "vitest";
import { s } from "../src/index.ts";

const O = s.object({ id: s.int() });
const proto = (): unknown => JSON.parse('{"__proto__":1}');
const rules = (r: ReturnType<typeof O.parse>) => (r.ok ? [] : r.error.data.issues.map((i) => [i.path, i.rule]));

describe("undeclared array under an open object", () => {
  it("an array's extra own property holding __proto__ is ignored", () => {
    const arr = Object.assign([1], { extra: proto() });
    expect(O.parse({ id: 1, e: arr }).ok).toBe(true);
  });

  it("a prototype key inside an item is reported at the item's index", () => {
    expect(rules(O.parse({ id: 1, e: [1, [proto()]] }))).toEqual([[["e", 1, 0], "type"]]);
  });
});
