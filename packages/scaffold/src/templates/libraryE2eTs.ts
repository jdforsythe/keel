/** `test/Example.e2e.ts` of a library: `Example` in a real browser through `serve({ page, props })` (k.e2e Libraries). */
export function libraryE2eTs(): string {
  return [
    `import { serve } from "@keel/testing/e2e";`,
    `import { expect, it } from "vitest";`,
    "",
    `it("shows its text at <id>.text, passes axe and takes a box", async () => {`,
    `  const app = await serve({ page: "src/Example.tsx", props: { id: "lib" } });`,
    `  const page = await app.open("/");`,
    `  expect((await page.find("lib.text")).text).toBe("Example");`,
    "  await page.a11y();",
    `  expect((await page.layout("lib.text")).width).toBeGreaterThan(0);`,
    "});",
    "",
  ].join("\n");
}
