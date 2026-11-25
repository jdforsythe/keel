/** `test/app.test.ts` of a workspace project: its first test, so the first `keel test` has a file to run (k.scaffold). */
export function appTestTs(): string {
  return [
    `import { expect, it } from "vitest";`,
    `import { routes } from "../modules/app/routes.ts";`,
    "",
    `it("starts with module app and no routes", () => {`,
    `  expect(routes.contract.module).toBe("app");`,
    "  expect(Object.keys(routes.contract.entries)).toEqual([]);",
    "});",
    "",
  ].join("\n");
}
