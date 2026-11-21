// Spec: k.docs "A diagnostic with `see` `k.ui` prints `see: keel docs k.ui` in compact and pretty, and `"see":"k.ui"` in json."
// Seed: none. Red: compact and pretty print `see: keel spec k.ui` today.
import { defineRule } from "@keel/check";
import { describe, expect, it } from "vitest";
import { run } from "./docs-support";

defineRule({
  code: "W2962",
  message: "see marker",
  see: "k.ui",
  explain: "Marker identifier found.",
  check: ({ file }) => {
    const at = file.source.indexOf("seeMarker");
    return at >= 0 ? [{ path: file.path, line: 1, col: at + 1 }] : [];
  },
});
const files = [{ path: "src/seeMarker.ts", source: "export const seeMarker = 1\n" }];

describe("k.docs see lines", () => {
  it("compact prints `see: keel docs k.ui`", async () => {
    const r = await run(["check", "--format=compact"], { files });
    expect(r.stdout).toContain("see: keel docs k.ui");
    expect(r.stdout).not.toContain("keel spec");
  });
  it("pretty prints `see: keel docs k.ui`", async () => {
    const r = await run(["check", "--format=pretty"], { files });
    expect(r.stdout).toContain("see: keel docs k.ui");
    expect(r.stdout).not.toContain("keel spec");
  });
  it('json keeps `"see":"k.ui"`', async () => {
    const r = await run(["check", "--format=json"], { files });
    expect(r.stdout).toContain('"see":"k.ui"');
    expect(r.stdout).not.toContain("keel docs");
  });
});
