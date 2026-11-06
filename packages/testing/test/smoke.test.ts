import { describe, expect, it } from "vitest";
import * as api from "../src/index.ts";

describe("@keel/testing", () => {
  it("exports an object", () => {
    expect(typeof api).toBe("object");
  });
});
