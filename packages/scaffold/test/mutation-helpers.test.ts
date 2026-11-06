// Example-based unit tests for pure internal helpers, written to kill surviving mutants (backlog 0096).
import { describe, expect, it } from "vitest";
import { scaffold } from "../src/index.ts";
import { alternation } from "../src/internal/alternation.ts";
import { basenames } from "../src/internal/basenames.ts";
import { camelJoin } from "../src/internal/camelJoin.ts";
import { dirOf } from "../src/internal/dirOf.ts";
import { fail } from "../src/internal/fail.ts";
import { lineIndent } from "../src/internal/lineIndent.ts";
import { literalOf } from "../src/internal/literalOf.ts";
import { moduleIds } from "../src/internal/moduleIds.ts";
import { moduleOf } from "../src/internal/moduleOf.ts";
import { parseSource } from "../src/internal/parseSource.ts";
import { quote } from "../src/internal/quote.ts";
import { relSpec } from "../src/internal/relSpec.ts";
import { restyleSpec } from "../src/internal/restyleSpec.ts";
import { rewriteId } from "../src/internal/rewriteId.ts";

describe("string helpers", () => {
  it("quote escapes backslash, single quote and newline, in that order", () => {
    expect(quote("plain")).toBe("'plain'");
    expect(quote("a\\b")).toBe("'a\\\\b'");
    expect(quote("it's")).toBe("'it\\'s'");
    expect(quote("a\nb")).toBe("'a\\nb'");
    expect(quote("\\'")).toBe("'\\\\\\''");
  });

  it("literalOf renders JSON values and refuses the rest", () => {
    expect(literalOf("a'b")).toBe("'a\\'b'");
    expect(literalOf(3)).toBe("3");
    expect(literalOf(-1.5)).toBe("-1.5");
    expect(literalOf(Number.NaN)).toBeNull();
    expect(literalOf(Number.POSITIVE_INFINITY)).toBeNull();
    expect(literalOf(true)).toBe("true");
    expect(literalOf(false)).toBe("false");
    expect(literalOf(null)).toBe("null");
    expect(literalOf({ a: [1, "x"] })).toBe('{"a":[1,"x"]}');
    expect(literalOf([])).toBe("[]");
    expect(literalOf(undefined)).toBeNull();
    expect(literalOf(() => 1)).toBeNull();
    expect(literalOf(10n)).toBeNull();
  });

  it("alternation escapes metacharacters and orders longest first, then alphabetical", () => {
    expect(alternation(["a", "abc", "ab", "b"])).toBe("abc|ab|a|b");
    expect(alternation(["b", "a"])).toBe("a|b");
    expect(alternation(["a.b", "c*"])).toBe("a\\.b|c\\*");
    expect(alternation(["^", "$", "|", "+", "?", "(", ")", "[", "]", "{", "}", "\\"])).toBe(
      "\\$|\\(|\\)|\\+|\\?|\\[|\\\\|\\]|\\^|\\{|\\||\\}",
    );
    expect(alternation([])).toBe("");
  });

  it("camelJoin and rewriteId", () => {
    expect(camelJoin(["items", "show"])).toBe("itemsShow");
    expect(camelJoin(["a"])).toBe("a");
    expect(camelJoin([])).toBe("");
    const names = new Map([["cart", "basket"]]);
    expect(rewriteId("cart.submit", names)).toBe("basket.submit");
    expect(rewriteId("cart-root", names)).toBe("basket-root");
    expect(rewriteId("cart", names)).toBe("basket");
    expect(rewriteId("carts.x", names)).toBe("carts.x");
    expect(rewriteId("x.cart", names)).toBe("x.cart");
    expect(rewriteId("cart.a\nb", names)).toBe("basket.a\nb");
    expect(rewriteId("", names)).toBe("");
  });

  it("lineIndent reads the leading whitespace of the offset's line", () => {
    expect(lineIndent("  a\n\t b\nc", 6)).toBe("\t ");
    expect(lineIndent("  a\n\t b\nc", 1)).toBe("  ");
    expect(lineIndent("  a\n\t b\nc", 0)).toBe("  ");
    expect(lineIndent("  a\n\t b\nc", 8)).toBe("");
    expect(lineIndent("x\n  \n", 3)).toBe("  ");
    expect(lineIndent("\n  y", 3)).toBe("  ");
  });
});

describe("path helpers", () => {
  it("dirOf", () => {
    expect(dirOf("a/b/c.ts")).toBe("a/b");
    expect(dirOf("a/b")).toBe("a");
    expect(dirOf("c.ts")).toBe("");
    expect(dirOf("/c.ts")).toBe("");
  });

  it("moduleOf and moduleIds", () => {
    expect(moduleOf("modules/orders/x.ts")).toBe("orders");
    expect(moduleOf("modules/orders")).toBeNull();
    expect(moduleOf("xmodules/orders/x.ts")).toBeNull();
    expect(moduleOf("modules//x.ts")).toBeNull();
    const files = new Map([
      ["modules/b/module.ts", ""],
      ["modules/a/module.ts", ""],
      ["modules/a/x/module.ts", ""],
      ["xmodules/c/module.ts", ""],
      ["modules/d/module.tsx", ""],
      ["modules/e/amodule.ts", ""],
    ]);
    expect(moduleIds(files)).toEqual(["a", "b"]);
  });

  it("relSpec", () => {
    expect(relSpec("a/b/x.ts", "a/b/y.ts")).toBe("./y.ts");
    expect(relSpec("a/b/x.ts", "a/c/y.ts")).toBe("../c/y.ts");
    expect(relSpec("a/b/x.ts", "y.ts")).toBe("../../y.ts");
    expect(relSpec("x.ts", "a/y.ts")).toBe("./a/y.ts");
    expect(relSpec("a/x.ts", "a/b/y.ts")).toBe("./b/y.ts");
    expect(relSpec("a/x.ts", "a/x.ts")).toBe("./x.ts");
    expect(relSpec("a/b/x.ts", "a/b")).toBe("../b");
  });

  it("restyleSpec keeps the original extension style", () => {
    expect(restyleSpec("./cart.store.ts", "m/cart.store.ts", "m/a.ts", "m/basket.store.ts")).toBe("./basket.store.ts");
    expect(restyleSpec("./cart.store", "m/cart.store.ts", "m/a.ts", "m/basket.store.ts")).toBe("./basket.store");
    expect(restyleSpec("./cart.store.js", "m/cart.store.ts", "m/a.ts", "m/basket.store.ts")).toBe("./basket.store.js");
    expect(restyleSpec("./cart.store.mjs", "m/cart.store.ts", "m/a.ts", "m/basket.store.ts")).toBe(
      "./basket.store.mjs",
    );
    expect(restyleSpec("./cart.store.jsx", "m/cart.store.tsx", "m/a.ts", "m/basket.store.tsx")).toBe(
      "./basket.store.jsx",
    );
    expect(restyleSpec("../x/cart", "x/cart.ts", "m/a.ts", "m/b.tsx")).toBe("./b");
    expect(restyleSpec("../x/cart.ts", "x/cart.ts", "m/a.ts", "n/b.tsx")).toBe("../n/b.tsx");
    expect(restyleSpec("../x/cart.cts", "x/cart.ts", "m/a.ts", "m/b.cts")).toBe("./b");
  });

  it("basenames lists matching non-generated paths, sorted", () => {
    const files = new Map([
      ["z/module.ts", ""],
      ["a/module.ts", ""],
      ["module.ts", ""],
      ["a/xmodule.ts", ""],
      ["module.ts.bak", ""],
      [".keel/module.ts", ""],
    ]);
    expect(basenames(files, "module.ts")).toEqual(["a/module.ts", "module.ts", "z/module.ts"]);
    expect(basenames(files, "module.ts", true)).toEqual([".keel/module.ts", "a/module.ts", "module.ts", "z/module.ts"]);
  });
});

describe("errors and parsing", () => {
  it("fail builds a scaffold.rejected error", () => {
    const r = fail("E1351", "module", "dup");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("scaffold.rejected");
      expect(r.error.message).toBe("E1351 dup");
      expect(r.error.data).toEqual({
        kind: "diag",
        code: "E1351",
        path: "module",
        line: 1,
        col: 1,
        message: "dup",
        see: "k.scaffold",
      });
    }
    const c = fail("E1353", "p", "m", { code: "E0001", path: "a.ts", line: 2, message: "x" });
    if (!c.ok) expect(c.error.data).toMatchObject({ cause: { code: "E0001" } });
  });

  it("badInput reports E1052 with the first issue's path and rule", () => {
    const r = scaffold("module", {}, new Map());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.data.code).toBe("E1052");
      expect(r.error.data.path).toBe("module");
      expect(r.error.data.message).toMatch(/^module: input does not fit its schema at \S+ \(\S+\)$/);
    }
    const r2 = scaffold("module", { id: 5 }, new Map());
    if (!r2.ok) expect(r2.error.data.message).toMatch(/ at id \(/);
  });

  it("parseSource picks the language from the extension and rejects syntax errors", () => {
    expect(parseSource("a.ts", "const x: number = 1")).not.toBeNull();
    expect(parseSource("a.mts", "const x: number = 1")).not.toBeNull();
    expect(parseSource("a.cts", "const x: number = 1")).not.toBeNull();
    expect(parseSource("a.tsx", "const x = <div />")).not.toBeNull();
    expect(parseSource("a.jsx", "const x = <div />")).not.toBeNull();
    expect(parseSource("a.js", "const x = 1")).not.toBeNull();
    expect(parseSource("a.js", "const x: number = 1")).toBeNull();
    expect(parseSource("a.ts", "const x = <div />")).toBeNull();
    expect(parseSource("a.ts", "const = ")).toBeNull();
    expect(parseSource("atsx", "const x: number = 1")).toBeNull();
  });
});
