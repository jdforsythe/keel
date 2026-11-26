import { render } from "@keel/testing";
import { expect, it } from "vitest";
import { Badge } from "../src/index.ts";

it("renders its text", () => {
  const view = render(Badge, { props: { id: "lib", text: "New" } });
  expect(view.find("lib.text").text).toBe("New");
  view.dispose();
});
