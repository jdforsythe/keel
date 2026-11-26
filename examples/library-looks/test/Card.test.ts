import { render } from "@keel/testing";
import { expect, it } from "vitest";
import { Card } from "../src/index.ts";

it("renders its title and body", () => {
  const view = render(Card, { props: { id: "lib", title: "Trip", children: () => "Packed" } });
  expect(view.find("lib.title").text).toBe("Trip");
  expect(view.find("lib.body").text).toBe("Packed");
  view.dispose();
});
