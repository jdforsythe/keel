// Seed 1337
// Golden app 1 does not exist as a public fixture; this uses 10 injected diagnostics instead (synthetic and real).
import { check, format } from "@keel/check";
import { expect, test } from "vitest";
import { approxTokens, FIXTURES, synth } from "./support.ts";

const FIX = "--- a/src/f.tsx\n+++ b/src/f.tsx\n@@ -1,1 +1,1 @@\n-  cart.items.push(item)\n+  tx.cart.addItem({ item })";

test("formatting 10 injected diagnostics in compact mode stays under 600 tokens (chars/4)", () => {
  const ds = Array.from({ length: 10 }, (_, i) => synth(i % 2 === 0 ? "E1501" : "E1003", i, `src/cart/f${i}.tsx`, FIX));
  expect(approxTokens(format(ds, { mode: "compact" }))).toBeLessThanOrEqual(600);
});

test("compact output for 10 files each with a real error stays under 600 tokens (chars/4)", () => {
  const bad = FIXTURES.find((f) => f.code === "E1403");
  const files = Array.from({ length: 10 }, (_, i) => ({ path: `src/c${i}.tsx`, source: bad?.bad ?? "" }));
  const out = format(check(files, {}).diagnostics, { mode: "compact" });
  expect(approxTokens(out)).toBeLessThanOrEqual(600);
});
