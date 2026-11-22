import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { store, stores } from "../src/index.ts";
import { storeIdClashes } from "../src/internal/index.ts";

const S = s.object({});

describe("storeIdClashes (@keel/store/internal, k.server E1550)", () => {
  const a = () => ({ s: store(S, {}, { id: "clash.s" }) });
  const b = () => ({ ...a(), t: store(S, {}, { id: "clash.s" }) });
  const c = () => ({ t: store(S, {}, { id: "clash.t" }) });
  const plain = () => ({ u: store(S, {}) });

  it("names the deeper route, both factories, the id and the other route", () => {
    const chain = [
      { route: "x.layout", name: "a", factory: a },
      { route: "x.page", name: "b", factory: b },
    ];
    expect(storeIdClashes([chain])).toEqual([
      "route x.page: stores: b and a (x.layout) both create store clash.s; name one factory",
    ]);
    expect([...stores().keys()].filter((k) => k.startsWith("clash."))).toEqual([]);
  });

  it("one factory named twice, factories over different ids, and default ids are none", () => {
    const one = [
      { route: "x.layout", name: "a", factory: a },
      { route: "x.page", name: "a", factory: a },
    ];
    const apart = [
      { route: "x.layout", name: "a", factory: a },
      { route: "x.page", name: "c", factory: c },
    ];
    const defaults = [
      { route: "x.layout", name: "p", factory: plain },
      { route: "x.page", name: "q", factory: () => ({ v: store(S, {}) }) },
    ];
    expect(storeIdClashes([one, apart, defaults], createCtx({ mode: "sim", seed: 1 }))).toEqual([]);
  });

  it("one message per pair of routes across chains sharing a layout", () => {
    const layout = { route: "x.layout", name: "a", factory: a };
    const page = { route: "x.page", name: "b", factory: b };
    expect(
      storeIdClashes([
        [layout, page],
        [layout, page],
      ]),
    ).toHaveLength(1);
  });

  it("a factory that throws is judged by the stores it made before the throw", () => {
    const thrower = () => {
      store(S, {}, { id: "clash.s" });
      throw new Error("boom");
    };
    const chain = [
      { route: "x.layout", name: "a", factory: a },
      { route: "x.page", name: "thrower", factory: thrower },
    ];
    expect(storeIdClashes([chain])).toHaveLength(1);
  });
});
