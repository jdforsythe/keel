// KERNEL_SINK_RUNGS (k.evidence `pii.json`): one rung per sink clause PII_SINKS names, each the kernel ledger's.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { KERNEL_SINK_RUNGS } from "../src/internal/KERNEL_SINK_RUNGS.ts";
import { PII_SINKS } from "../src/internal/PII_SINKS.ts";

const ledger: unknown = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "..", "..", "..", "tooling", "ledger", "ledger.json"), "utf8"),
);
const clauses = typeof ledger === "object" && ledger !== null ? Reflect.get(ledger, "clauses") : undefined;
const rungOf = (item: string): unknown => {
  const all: readonly unknown[] = Array.isArray(clauses) ? clauses : [];
  const hit = all.find((c) => typeof c === "object" && c !== null && Reflect.get(c, "item") === item);
  return typeof hit === "object" && hit !== null ? Reflect.get(hit, "rung") : undefined;
};

describe("KERNEL_SINK_RUNGS", () => {
  test("names exactly the sink clauses, each at the kernel ledger's rung", () => {
    expect(Object.keys(KERNEL_SINK_RUNGS).sort()).toEqual(PII_SINKS.map((s) => s.clause).sort());
    for (const s of PII_SINKS) expect(KERNEL_SINK_RUNGS[s.clause], s.clause).toBe(rungOf(s.clause) ?? "none");
  });
});
