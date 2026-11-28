// The undeclared-data scan walks an array by index: an array with an own extra property is not a plain array and is
// refused at its own path, while a prototype key inside an item is reported at its index (k.schema Plain data).
import { describe, expect, it } from "vitest";
import { s } from "../src/index.ts";

const O = s.object({ id: s.int() });
const proto = (): unknown => JSON.parse('{"__proto__":1}');
const rules = (r: ReturnType<typeof O.parse>) => (r.ok ? [] : r.error.data.issues.map((i) => [i.path, i.rule]));

describe("undeclared array under an open object", () => {
  it("an array with an extra own property is refused at the array's path, nothing under it read", () => {
    const arr = Object.assign([1], { extra: proto() });
    expect(rules(O.parse({ id: 1, e: arr }))).toEqual([[["e"], "type"]]);
  });

  it("a prototype key inside an item is reported at the item's index", () => {
    expect(rules(O.parse({ id: 1, e: [1, [proto()]] }))).toEqual([[["e", 1, 0], "type"]]);
  });
});
