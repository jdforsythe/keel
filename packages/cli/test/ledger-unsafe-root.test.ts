// The ledger's unsafe count (k.ledger File) in a standalone app: `keel ledger` run in the app's own folder counts the
// `unsafe(` calls of its root `modules/**`, as it counts a package's `src` and `unsafe`; an `apps/<app>/**` counts per app.
import { expect, test } from "vitest";
import { buildLedger } from "../src/internal/buildLedger.ts";

const call =
  'import { unsafe } from "@keel/ctx";\nexport const v = unsafe("the canvas library writes its pixels", () => 1);\n';

test("a standalone app's modules count toward unsafe; other root folders do not", () => {
  const at = (path: string): number => buildLedger([{ path, source: call }], "none").unsafe;
  expect(at("modules/charts/unsafe/canvas.ts")).toBe(1);
  expect(at("modules/charts/a.ts")).toBe(1);
  expect(buildLedger([{ path: "apps/shop/modules/charts/unsafe/canvas.ts", source: call }], "none").appUnsafe).toEqual({
    shop: 1,
  });
  expect(at("packages/ui/src/a.ts")).toBe(1);
  expect(at("tooling/a.ts")).toBe(0);
});
