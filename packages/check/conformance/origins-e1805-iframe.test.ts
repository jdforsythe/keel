// rfc:0160 conformance: a lowercase `<iframe>` is E1805 whose message or fix names `Frame`.
// Spec: k.ui, Rules "E1805 lowercase intrinsic element in app code (fix: matching base element)"
// Seed 1337 (no generated input: one fixture).
import { check } from "@keel/check";
import { describe, expect, test } from "vitest";
import { one } from "./support.ts";

describe("rfc:0160 conformance: E1805 on iframe", () => {
  test("rfc:0160 conformance: a lowercase `<iframe>` is E1805 whose message or fix names `Frame`", () => {
    const src = `export default function C() { return <iframe src="https://v.example/e/1" title="Demo" /> }\n`;
    const found = check(one(src), { types: false }).diagnostics.filter((d) => d.code === "E1805");
    expect(found).toHaveLength(1);
    const d = found[0];
    expect(`${d?.message ?? ""}\n${d?.fix ?? ""}`).toContain("Frame");
  });
});
