import { expect, test } from "vitest";
import { codes } from "./support.ts";

test("E1404: two elements with the same explicit id produce a diagnostic", () => {
  const d = codes(`export default function C() { return <div><a id="cart.x">1</a><b id="cart.x">2</b></div> }`).filter(
    (x) => x.code === "E1404",
  );
  expect(d.length).toBeGreaterThanOrEqual(1);
  expect(d[0]?.message).toContain("cart.x");
});

test("E1404: distinct explicit ids emit no E1404", () => {
  const d = codes(`export default function C() { return <div><a id="cart.x">1</a><b id="cart.y">2</b></div> }`);
  expect(d.map((x) => x.code)).not.toContain("E1404");
});
