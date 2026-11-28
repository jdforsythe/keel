/** `test/Example.test.ts` of a library: renders `Example` and finds its `<id>.text` (k.testing). */
export function libraryTestTs(): string {
  return [
    `import { render } from "@keel/testing";`,
    `import { expect, it } from "vitest";`,
    `import { Example } from "../src/index.ts";`,
    "",
    `it("renders its text at <id>.text", () => {`,
    `  const view = render(Example, { props: { id: "lib" } });`,
    `  expect(view.find("lib.text").text).toBe("Example");`,
    "  view.dispose();",
    "});",
    "",
  ].join("\n");
}
