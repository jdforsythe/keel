// explore examples for the absent optional payload and for edges `tx` refuses (k.model).
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";
import { explore } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { domainOf } from "../src/internal/domainOf.ts";

const codeOf = (fn: () => unknown): unknown => {
  try {
    fn();
    return undefined;
  } catch (e) {
    return typeof e === "object" && e !== null && "code" in e ? e.code : e;
  }
};

describe("explore", () => {
  it("an optional outside an object field is `undefined` first; an object field leaves its key out; no marker leaks", () => {
    expect(domainOf(s.boolean().optional())).toEqual([undefined, false, true]);
    expect(domainOf(s.object({ o: s.boolean().optional() }))).toEqual([{}, { o: false }, { o: true }]);
  });

  it("an edge `tx` refuses before the function runs (store.undeclared) fails with E1710 naming it", () => {
    scope(
      () => {
        const st = store(s.object({ n: s.int({ min: 0, max: 1 }) }), { n: 0 }, { id: "ex.undeclared" });
        const on = transaction(st, "ex.undeclared.on", s.object({}), () => ({ n: 1 }));
        const off = transaction(st, "ex.undeclared.off", s.object({}), () => ({ n: 0 }));
        st.uses([on]);
        let message = "";
        const code = codeOf(() => {
          try {
            explore([on, off]);
          } catch (e) {
            message = e instanceof Error ? e.message : "";
            throw e;
          }
        });
        expect(code).toBe("E1710");
        expect(message).toContain("ex.undeclared.off answered store.undeclared");
        expect(st.get("n")).toBe(0);
      },
      { detached: true },
    );
  });
});
