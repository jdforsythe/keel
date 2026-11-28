// Exact-output tests for specClauses (mutation killers).
import { describe, expect, it } from "vitest";
import { specClauses } from "../src/internal/specClauses.ts";

const f = (path: string, source: string) => ({ path, source });

describe("specClauses", () => {
  const sec = (...body: string[]): string => ["# t", "intro", ...body].join("\n");

  it("reads the Conformance list: numbered from 1, text trimmed after the dash", () => {
    const src = sec("**Conformance.**", "- first  ", "- second", "", "- after blank");
    expect(specClauses([f("spec/kernel/k.x.md", src)])).toEqual([
      { id: "k.x", n: 1, text: "first", line: 4 },
      { id: "k.x", n: 2, text: "second", line: 5 },
    ]);
  });

  it("stops at a bold line; skips non-list lines inside; whitespace-only line ends it", () => {
    expect(
      specClauses([f("spec/std/s.md", sec("**Conformance.**", "- a", "prose", "-b", "- c", "**Next.**", "- d"))]),
    ).toEqual([
      { id: "s", n: 1, text: "a", line: 4 },
      { id: "s", n: 2, text: "c", line: 7 },
    ]);
    expect(specClauses([f("spec/std/s.md", sec("**Conformance.**", "- a", "   ", "- b"))])).toEqual([
      { id: "s", n: 1, text: "a", line: 4 },
    ]);
  });

  it("ignores list items before the heading and non-matching paths; continues with later files", () => {
    const good = f("spec/kernel/ok.md", sec("- before", "**Conformance.**", "- yes"));
    const files = [
      f("spec/kernel/none.md", sec("- x")),
      f("spec/other/o.md", sec("**Conformance.**", "- o")),
      f("spec/kernel/a/b.md", sec("**Conformance.**", "- nested")),
      f("xspec/kernel/x.md", sec("**Conformance.**", "- x")),
      f("spec/kernel/x.mdx", sec("**Conformance.**", "- x")),
      f("spec/kernel/.md", sec("**Conformance.**", "- empty id")),
      f("spec/kernel/ind.md", sec(" **Conformance.**", "- indented")),
      good,
    ];
    expect(specClauses(files)).toEqual([{ id: "ok", n: 1, text: "yes", line: 5 }]);
  });

  it("only the first Conformance heading counts; counters restart per file", () => {
    const a = f("spec/kernel/a.md", sec("**Conformance.**", "- 1", "**Conformance.**", "- 2"));
    const b = f("spec/std/b.md", sec("**Conformance.**", "- 3"));
    expect(specClauses([a, b])).toEqual([
      { id: "a", n: 1, text: "1", line: 4 },
      { id: "b", n: 1, text: "3", line: 4 },
    ]);
  });

  it("heading at the very end yields nothing", () => {
    expect(specClauses([f("spec/kernel/e.md", "**Conformance.**")])).toEqual([]);
    expect(specClauses([])).toEqual([]);
  });
});
