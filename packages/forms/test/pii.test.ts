// @vitest-environment happy-dom
// k.privacy: a control bound to a marked path carries `data-k-pii`, an array item matched by `*`.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { expect, it } from "vitest";
import { form } from "../src/index.ts";

const Order = s.object({
  note: s.string(),
  buyer: s.object({ email: s.string().pii("contact") }),
  lines: s.array(s.object({ sku: s.string(), recipient: s.string() }).pii("name")),
});

it("marks a bound control with the nearest class and leaves an unmarked one alone", () => {
  scope(() => {
    const f = form(Order);
    const els = ["note", "buyer.email", "lines.1.recipient"].map((p) => {
      const el = document.createElement("input");
      f.field(p).bind(el);
      return el.getAttribute("data-k-pii");
    });
    expect(els).toEqual([null, "contact", "name"]);
  });
});
