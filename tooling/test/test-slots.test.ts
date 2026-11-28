import { describe, expect, it } from "vitest";
import { testSlots } from "../test-slots.mjs";

describe("testSlots", () => {
  it("runs four tasks on a quiet machine, with workers for half again the cores between them", () => {
    expect(testSlots({ cores: 16, load: 1 })).toEqual({ tasks: 4, workers: 6, free: 15 });
  });
  it("runs fewer tasks with fewer workers as the load takes cores", () => {
    expect(testSlots({ cores: 16, load: 8 })).toEqual({ tasks: 3, workers: 4, free: 8 });
    expect(testSlots({ cores: 16, load: 40 })).toEqual({ tasks: 2, workers: 3, free: 4 });
  });
  it("never sizes the run under a quarter of the machine", () => {
    expect(testSlots({ cores: 16, load: 400 }).free).toBe(4);
  });
  it("leaves a machine of four cores or fewer one task at vitest's own workers", () => {
    expect(testSlots({ cores: 4, load: 0 })).toEqual({ tasks: 1, workers: undefined, free: 4 });
  });
  it("takes KEEL_TEST_TASKS and KEEL_TEST_WORKERS over its own reckoning", () => {
    const env = { KEEL_TEST_TASKS: "6", KEEL_TEST_WORKERS: "10" };
    expect(testSlots({ cores: 16, load: 40, env })).toMatchObject({ tasks: 6, workers: 10 });
    expect(testSlots({ cores: 16, load: 0, env: { KEEL_TEST_WORKERS: "0" } }).workers).toBe(6);
  });
});
