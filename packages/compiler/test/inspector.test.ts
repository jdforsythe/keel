// Inspector hooks (k.cli, RFC 0042): the registry and the per-request read of every section.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { inspector } from "../src/inspect/inspector.ts";
import { inspectorSections } from "../src/inspect/inspectorSections.ts";
import { inspectors } from "../src/inspect/inspectors.ts";

const SEED = 1337;
const Count = s.object({ n: s.int({ min: 0 }) });
const ctx = createCtx({ mode: "sim", seed: 1 });
let seq = 0;
const fresh = (): string => {
  seq += 1;
  return `orders.s${seq}`;
};

describe("inspector", () => {
  it("serves every valid value encoded with the schema's doc, and nothing else for that id", () => {
    fc.assert(
      fc.property(fc.nat(1000), (n) => {
        inspectors.clear();
        const id = fresh();
        inspector({ id, schema: Count, read: () => ({ n }) });
        const r = inspectorSections(ctx);
        expect(r.sections).toEqual({ [id]: { doc: Count.doc(), value: { n } } });
        expect(r.diags).toEqual([]);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("passes the ctx to read", () => {
    inspectors.clear();
    const seen: unknown[] = [];
    inspector({
      id: fresh(),
      schema: Count,
      read: (c) => {
        seen.push(c);
        return { n: 1 };
      },
    });
    inspectorSections(ctx);
    expect(seen).toEqual([ctx]);
  });

  it("a value failing its schema is { doc, error } with E1057 naming the path and rule", () => {
    inspectors.clear();
    const id = fresh();
    inspector({ id, schema: Count, read: () => ({ n: -1 }) });
    const r = inspectorSections(ctx);
    expect(r.sections[id]).toEqual({
      doc: Count.doc(),
      error: `E1057 inspector section ${id} fails its schema at n (min)`,
    });
    expect(r.diags).toEqual([{ code: "E1057", message: `inspector section ${id} fails its schema at n (min)` }]);
  });

  it("a throwing read is E1057 and the other sections are still read", () => {
    inspectors.clear();
    const bad = fresh();
    const good = fresh();
    inspector({
      id: bad,
      schema: Count,
      read: () => {
        throw new Error("x".repeat(100));
      },
    });
    inspector({ id: good, schema: Count, read: () => ({ n: 2 }) });
    const r = inspectorSections(ctx);
    expect(r.diags).toHaveLength(1);
    expect(r.diags[0]?.message).toMatch(
      new RegExp(`^inspector section ${bad.replace(".", "\\.")} read threw: x{57}\\.\\.\\.$`),
    );
    expect(r.sections[good]).toEqual({ doc: Count.doc(), value: { n: 2 } });
  });

  it("a second registration of an id throws E1057 and keeps the first", () => {
    inspectors.clear();
    const id = fresh();
    inspector({ id, schema: Count, read: () => ({ n: 1 }) });
    expect(() => inspector({ id, schema: Count, read: () => ({ n: 2 }) })).toThrow(
      `E1057 inspector section ${id} registered twice`,
    );
    expect(inspectorSections(ctx).sections[id]).toEqual({ doc: Count.doc(), value: { n: 1 } });
  });
});
