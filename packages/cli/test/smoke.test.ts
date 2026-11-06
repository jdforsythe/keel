import { describe, expect, it } from "vitest";
import * as api from "../src/index.ts";

describe("@keel/cli", () => {
  it("exports an object", () => {
    expect(typeof api).toBe("object");
  });
});
