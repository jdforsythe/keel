// The three write bodies the board's outbox sends (a name or todo fields plus the write's `key` and `base`), and `Nothing`, the answer of a write with nothing to say.
import { describe, expect, it } from "vitest";
import { ListWrite } from "../modules/api/ListWrite.schema.ts";
import { Nothing } from "../modules/api/Nothing.schema.ts";
import { TodoWrite } from "../modules/api/TodoWrite.schema.ts";
import { ToggleWrite } from "../modules/api/ToggleWrite.schema.ts";

const w = { key: "w1", base: 0 };

describe("ListWrite", () => {
  it("accepts a name of 1 to 60 characters with a write", () => {
    for (const name of ["a", "Home", "x".repeat(60)]) {
      const r = ListWrite.parse({ name, write: w });
      expect(r.ok && r.value.name === name && r.value.write.base === 0).toBe(true);
    }
  });
  it("refuses an empty or over-long name, a missing write, and a negative or fractional base", () => {
    expect(ListWrite.parse({ name: "", write: w }).ok).toBe(false);
    expect(ListWrite.parse({ name: "x".repeat(61), write: w }).ok).toBe(false);
    expect(ListWrite.parse({ name: "Home" }).ok).toBe(false);
    expect(ListWrite.parse({ name: "Home", write: { key: "w1", base: -1 } }).ok).toBe(false);
    expect(ListWrite.parse({ name: "Home", write: { key: "w1", base: 1.5 } }).ok).toBe(false);
  });
});

describe("TodoWrite", () => {
  it("accepts a title of 1 to 120 characters, each priority, and a write", () => {
    for (const priority of ["low", "normal", "high"]) {
      for (const title of ["a", "x".repeat(120)]) {
        const r = TodoWrite.parse({ title, priority, write: w });
        expect(r.ok && r.value.title === title && r.value.priority === priority).toBe(true);
      }
    }
  });
  it("refuses an empty or over-long title, an unknown priority and a missing write", () => {
    expect(TodoWrite.parse({ title: "", priority: "low", write: w }).ok).toBe(false);
    expect(TodoWrite.parse({ title: "x".repeat(121), priority: "low", write: w }).ok).toBe(false);
    expect(TodoWrite.parse({ title: "Milk", priority: "urgent", write: w }).ok).toBe(false);
    expect(TodoWrite.parse({ title: "Milk", priority: "low" }).ok).toBe(false);
  });
});

describe("ToggleWrite", () => {
  it("accepts a write and nothing else is required", () => {
    const r = ToggleWrite.parse({ write: { key: "w9", base: 7 } });
    expect(r.ok && r.value.write.base === 7).toBe(true);
  });
  it("refuses a body without a write, with an empty key, or with a non-integer base", () => {
    expect(ToggleWrite.parse({}).ok).toBe(false);
    expect(ToggleWrite.parse({ write: { key: "", base: 0 } }).ok).toBe(false);
    expect(ToggleWrite.parse({ write: { key: "w1", base: "0" } }).ok).toBe(false);
  });
});

describe("Nothing", () => {
  it("accepts an empty object, the answer of a write with nothing to say", () => {
    expect(Nothing.parse({})).toEqual({ ok: true, value: {} });
  });
  it("refuses a non-object", () => {
    for (const v of [null, "{}", 0, []]) expect(Nothing.parse(v).ok).toBe(false);
  });
});
