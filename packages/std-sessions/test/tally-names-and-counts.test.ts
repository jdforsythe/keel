// std.monitor: the tally holds transaction names and integer counts only, so no `.pii()` value can be kept in it.
// Seed 1337
import { s } from "@keel/schema";
import { describe, expect, test } from "vitest";
import { Tally } from "../src/monitor/Tally.schema.ts";

describe("Tally", () => {
  test("is a closed object of v, from, to and integer counts by name; a marked value has no place in it", () => {
    const marked = s.string().pii("contact");
    const value = marked.encode("ada@example.com");
    expect(Tally.parse({ v: 1, from: 0, to: 1, tx: { "api.addTodo": 2 } }).ok).toBe(true);
    expect(Tally.parse({ v: 1, from: 0, to: 1, tx: {}, payload: value }).ok).toBe(false);
    expect(Tally.parse({ v: 1, from: 0, to: 1, tx: { "api.addTodo": value } }).ok).toBe(false);
    expect(Object.keys(Tally.node.kind === "object" ? Tally.node.fields : {}).sort()).toEqual([
      "from",
      "to",
      "tx",
      "v",
    ]);
  });
});
