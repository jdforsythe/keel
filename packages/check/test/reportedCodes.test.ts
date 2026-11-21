import { describe, expect, it } from "vitest";
import { reportedCodes } from "../src/index.ts";

describe("reportedCodes", () => {
  it("lists the contract and route-table codes check reports", () => {
    const codes = reportedCodes();
    for (const c of ["E1502", "E1503", "E1504", "E1506", "E1509", "E1510", "E1515"]) expect(codes).toContain(c);
  });
  it("is sorted and unique", () => {
    const codes = reportedCodes();
    expect([...new Set(codes)].sort()).toEqual(codes);
  });
});
