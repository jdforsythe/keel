import { describe, expect, it } from "vitest";
import * as api from "../src/index.ts";

describe("@keel/check", () => {
  it("exports an object", () => {
    expect(typeof api).toBe("object");
  });
});
