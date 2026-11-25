import { expect, it } from "vitest";
import { Fragment, jsx, jsxs } from "../src/jsx-runtime/index.ts";

it("the automatic JSX runtime throws: JSX renders only as the Keel compiler lowers it", () => {
  for (const call of [() => jsx("div", {}), () => jsxs("div", { children: [] }), () => Fragment({})])
    expect(call).toThrow(/does not render: Keel renders the source it compiles/);
});
