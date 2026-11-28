// KERNEL_SINK_RUNGS (k.evidence `pii.json`): one rung per sink clause PII_SINKS names, each the kernel ledger's.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { KERNEL_SINK_RUNGS } from "../src/internal/KERNEL_SINK_RUNGS.ts";
import { PII_SINKS } from "../src/internal/PII_SINKS.ts";
import { clauseKey } from "../src/internal/clauseKey.ts";
import { specClauses } from "../src/internal/specClauses.ts";

const ledger: unknown = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "..", "..", "..", "tooling", "ledger", "ledger.json"), "utf8"),
);
const clauses = typeof ledger === "object" && ledger !== null ? Reflect.get(ledger, "clauses") : undefined;
const rungOf = (item: string): unknown => {
  const all: readonly unknown[] = Array.isArray(clauses) ? clauses : [];
  const hit = all.find((c) => typeof c === "object" && c !== null && Reflect.get(c, "item") === item);
  return typeof hit === "object" && hit !== null ? Reflect.get(hit, "rung") : undefined;
};

const ROOT = path.join(import.meta.dirname, "..", "..", "..");

describe("PII_SINKS", () => {
  test("each sink names a Conformance clause of the spec by its item", () => {
    for (const s of PII_SINKS) {
      const id = s.clause.slice(0, s.clause.indexOf("#"));
      const rel = `spec/${id.startsWith("k.") ? "kernel" : "std"}/${id}.md`;
      const items = specClauses([{ path: rel, source: readFileSync(path.join(ROOT, rel), "utf8") }]).map(
        (c) => `${c.id}#${clauseKey(c.text)}`,
      );
      expect(items, s.clause).toContain(s.clause);
    }
  });
});

describe("KERNEL_SINK_RUNGS", () => {
  test("names exactly the sink clauses, each at the kernel ledger's rung", () => {
    expect(Object.keys(KERNEL_SINK_RUNGS).sort()).toEqual(PII_SINKS.map((s) => s.clause).sort());
    for (const s of PII_SINKS) expect(KERNEL_SINK_RUNGS[s.clause], s.clause).toBe(rungOf(s.clause) ?? "none");
  });
});
