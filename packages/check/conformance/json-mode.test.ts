// Seed 1337
import { format } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { lines, SEED, synth } from "./support.ts";

test("json mode is NDJSON with a final summary line", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 12 }), (n) => {
      const ds = Array.from({ length: n }, (_, i) => synth("E1042", i));
      const out = lines(format(ds, { mode: "json" }));
      expect(out.length).toBe(n + 1);
      const parsed = out.map((l) => JSON.parse(l));
      for (const d of parsed.slice(0, -1)) {
        expect(d.kind).toBe("diag");
        expect(d.code).toBe("E1042");
        expect(typeof d.path).toBe("string");
        expect(typeof d.line).toBe("number");
        expect(typeof d.col).toBe("number");
        expect(typeof d.message).toBe("string");
      }
      expect(parsed[parsed.length - 1]?.kind).toBe("summary");
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("json mode does not cap per code", () => {
  const ds = Array.from({ length: 12 }, (_, i) => synth("E1042", i));
  expect(lines(format(ds, { mode: "json" })).length).toBe(13);
});

test("json mode carries fix when present", () => {
  const out = lines(
    format([synth("E1042", 0, "a.tsx", "--- a/a.tsx\n+++ b/a.tsx\n@@ -1 +1 @@\n-x\n+y")], { mode: "json" }),
  );
  expect(JSON.parse(out[0] ?? "{}").fix).toContain("+y");
});
