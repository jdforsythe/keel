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
  scope(
    () => {
      const f = form(Order);
      const els = ["note", "buyer.email", "lines.1.recipient"].map((p) => {
        const el = document.createElement("input");
        f.field(p).bind(el);
        return el.getAttribute("data-k-pii");
      });
      expect(els).toEqual([null, "contact", "name"]);
    },
    { detached: true },
  );
});

it("reads the class along declared fields: a declared object's own mark, a parent's for an unmarked one, union and wrapper marks, an open variant's `*`", () => {
  const Place = s.object({
    address: s
      .object({
        street: s.string(),
        geo: s.object({ lat: s.number() }).pii("special"),
        unit: s.object({ n: s.string() }),
      })
      .pii("location"),
    pick: s.union("t", [
      s.object({ t: s.literal("a"), who: s.string() }).pii("name"),
      s.object({ t: s.literal("b"), at: s.string() }),
    ]),
    phone: s.string().pii("contact").optional(),
    plain: s.object({ x: s.string() }),
  });
  scope(
    () => {
      const f = form(Place);
      const classes = [
        "address",
        "address.geo",
        "address.geo.lat",
        "address.unit",
        "address.unit.n",
        "pick.who",
        "pick.at",
        "phone",
        "plain",
        "plain.x",
      ].map((p) => {
        const el = document.createElement("input");
        f.field(p).bind(el);
        return el.getAttribute("data-k-pii");
      });
      expect(classes).toEqual([
        "location",
        "special",
        "special",
        "location",
        "location",
        "name",
        // `pick.at` is declared by the unmarked variant only, and the marked one is open: a value of it may hold `at`.
        "name",
        "contact",
        null,
        null,
      ]);
    },
    { detached: true },
  );
});
