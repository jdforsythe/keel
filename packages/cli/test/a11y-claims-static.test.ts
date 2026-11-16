// k.a11y Claims: a claim is `example` only when `keel check` reports none of the criterion's static codes. Seed 1337.
import path from "node:path";
import { repoRoot } from "@keel/tooling/repo-root";
import { describe, expect, it } from "vitest";
import type { A11yCriteriaMap } from "../src/internal/A11yCriteriaMap.ts";
import { a11yClaims } from "../src/internal/a11yClaims.ts";
import { a11yFindings } from "../src/internal/a11yFindings.ts";

const MAP: A11yCriteriaMap = new Map([
  ["1.1.1", { render: ["image-alt"], static: ["E1802"] }],
  ["1.4.3", { render: ["E1804"], static: ["E1804"] }],
]);
const routes = JSON.stringify({ data: { "m.r": { module: "m" }, "n.r": { module: "n" } }, hash: "x" });
const runs = JSON.stringify(
  ["m.r", "n.r"].map((route) => ({
    route,
    component: null,
    rules: ["E1804", "image-alt"],
    violations: [],
    file: "t.test.ts",
    test: route,
    passed: true,
  })),
);
const files = [
  { path: "app/.keel/routes.json", source: routes },
  { path: "app/reports/a11y.json", source: runs },
];
const rungs = (findings: { code: string; path: string }[]) =>
  Object.fromEntries(a11yClaims(files, MAP, findings).map((c) => [c.item, c.rung]));

describe("a11y claims and static findings", () => {
  it("withholds only the criteria of a code found in the route's module", () => {
    expect(rungs([])).toEqual({
      "a11y:m.r#1.1.1": "example",
      "a11y:m.r#1.4.3": "example",
      "a11y:n.r#1.1.1": "example",
      "a11y:n.r#1.4.3": "example",
    });
    expect(rungs([{ code: "E1802", path: "app/modules/m/Page.tsx" }])).toEqual({
      "a11y:m.r#1.1.1": "none",
      "a11y:m.r#1.4.3": "example",
      "a11y:n.r#1.1.1": "example",
      "a11y:n.r#1.4.3": "example",
    });
  });

  it("finds E1802 through the check pipeline in a routed project's module", () => {
    const page = {
      path: "app/modules/m/Page.tsx",
      source: `import { Image } from "@keel/ui";\nexport function Page() {\n  return <Image src="/a.png" />;\n}\n`,
    };
    // A root whose node_modules resolves `@keel/ui`, so the type pass sees the required props.
    const root = path.join(repoRoot(import.meta.dirname), "packages", "testing");
    const found = a11yFindings(root, [...files, page]);
    expect(found).toContainEqual({ code: "E1802", path: "app/modules/m/Page.tsx" });
    expect(a11yFindings(root, [page])).toEqual([]);
  });
});
