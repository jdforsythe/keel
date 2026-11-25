// k.ledger File, k.host-element Ledger, k.library Ledger: which project files the ledger's counts read.
import { expect, test } from "vitest";
import { projectCounts } from "../src/internal/projectCounts.ts";

test("a package's src/ and unsafe/ and a root modules/ feed both counts; an app's files host elements alone", () => {
  expect(projectCounts("packages/ui/src/a.ts")).toEqual({ unsafe: true, hostElements: true });
  expect(projectCounts("packages/ui/unsafe/a.ts")).toEqual({ unsafe: true, hostElements: true });
  expect(projectCounts("modules/shop/Page.tsx")).toEqual({ unsafe: true, hostElements: true });
  expect(projectCounts("apps/golden-1/modules/a/Page.tsx")).toEqual({ unsafe: false, hostElements: true });
  expect(projectCounts("packages/ui/test/a.test.ts")).toEqual({ unsafe: false, hostElements: false });
});

test("a file under a node_modules folder is a library's, read by neither count", () => {
  for (const p of ["node_modules/@acme/charts/src/a.ts", "apps/x/node_modules/@acme/charts/src/a.ts"])
    expect(projectCounts(p)).toEqual({ unsafe: false, hostElements: false });
});
