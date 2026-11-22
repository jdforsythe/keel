import { describe, expect, it } from "vitest";
import { committedRungs, compareLedger, parseFresh } from "../ledger-compare.mjs";

const file = {
  version: 1,
  unsafe: 2,
  rungs: { example: 2, probabilistic: 1, exhaustive: 0, proven: 0, monitored: 0 },
  exports: [
    { pkg: "a", name: "x", file: "packages/a/src/x.ts", rung: "probabilistic" },
    { pkg: "a", name: "y", file: "packages/a/src/y.ts", rung: "none" },
  ],
  clauses: [{ item: "k.one#1", rung: "example" }],
  a11y: [{ item: "a11y:r#1.1.1", rung: "example" }],
};
const tree = {
  records: [
    { item: "packages/a/src/x.ts#x", rung: "probabilistic" },
    { item: "packages/a/src/y.ts#y", rung: "none" },
    { item: "k.one#1", rung: "example" },
  ],
  unsafe: 2,
  rungs: { example: 2, probabilistic: 1, exhaustive: 0, proven: 0, monitored: 0 },
};
const treeWithA11y = { ...tree, records: [...tree.records, { item: "a11y:r#1.1.1", rung: "example" }] };
const messages = (f: unknown, t: typeof tree, a11y = false) =>
  compareLedger(f, t, a11y).map((d: { message: string }) => d.message);

describe("compareLedger", () => {
  it("finds nothing when the file is what the tree produces", () => {
    expect(messages(file, tree)).toEqual([]);
    expect(messages(file, treeWithA11y, true)).toEqual([]);
  });

  it("finds a rung raised by hand, which `ledger --diff` accepts", () => {
    const edited = { ...file, clauses: [{ item: "k.one#1", rung: "proven" }] };
    expect(messages(edited, tree)).toEqual(["k.one#1 is proven in the ledger file, example in the tree"]);
  });

  it("finds an item whose source is gone (a deleted export still listed as verified)", () => {
    const gone = {
      ...file,
      exports: [...file.exports, { pkg: "c", name: "Hashed", file: "packages/c/src/h.ts", rung: "probabilistic" }],
    };
    expect(messages(gone, tree)).toEqual(["packages/c/src/h.ts#Hashed is in the ledger file and not in the tree"]);
  });

  it("finds an item the tree gained and the file lacks", () => {
    const fewer = { ...file, clauses: [] };
    expect(messages(fewer, tree)).toEqual(["k.one#1 (example) is in the tree and not in the ledger file"]);
  });

  it("finds a changed unsafe count in either direction", () => {
    expect(messages({ ...file, unsafe: 1 }, tree)).toEqual(["unsafe count is 1 in the ledger file, 2 in the tree"]);
    expect(messages({ ...file, unsafe: 3 }, tree)).toEqual(["unsafe count is 3 in the ledger file, 2 in the tree"]);
  });

  it("leaves WCAG items and rung counts alone until asked", () => {
    const edited = { ...file, a11y: [], rungs: { ...file.rungs, example: 99 } };
    expect(messages(edited, tree)).toEqual([]);
    expect(messages(edited, treeWithA11y, true)).toEqual([
      "a11y:r#1.1.1 (example) is in the tree and not in the ledger file",
      "example is held by 99 items in the ledger file, 2 in the tree",
    ]);
  });

  it("treats a missing unsafe count as zero", () => {
    expect(messages({ ...file, unsafe: undefined }, { ...tree, unsafe: 0 })).toEqual([]);
  });
});

describe("committedRungs", () => {
  it("keys exports by file and name, clauses by item and WCAG items only on request", () => {
    expect([...committedRungs(file, false).keys()]).toEqual([
      "packages/a/src/x.ts#x",
      "packages/a/src/y.ts#y",
      "k.one#1",
    ]);
    expect([...committedRungs(file, true).keys()]).toContain("a11y:r#1.1.1");
  });
});

describe("parseFresh", () => {
  it("reads the ledger records and the summary's unsafe and rung counts", () => {
    const text = [
      '{"kind":"ledger","item":"k.one#1","rung":"example","evidence":"x"}',
      '{"kind":"ledger.mutation","file":"f","score":1,"survived":0,"fresh":true}',
      "",
      '{"kind":"summary","ok":true,"name":"ledger","counts":{"items":1,"unsafe":4,"example":1}}',
      '{"kind":"diag","code":"W1714","message":"m"}',
    ].join("\n");
    expect(parseFresh(text)).toEqual({
      records: [{ item: "k.one#1", rung: "example" }],
      unsafe: 4,
      rungs: { example: 1, probabilistic: 0, exhaustive: 0, proven: 0, monitored: 0 },
    });
  });

  it("throws on output without a summary", () => {
    expect(() => parseFresh('{"kind":"ledger","item":"a#1","rung":"none"}')).toThrow("no summary");
  });
});
