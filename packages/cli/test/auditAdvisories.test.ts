// auditAdvisories (k.evidence `--audit`): the advisories of a `pnpm audit --json` document, by id, or undefined for
// anything that is not that shape (E1064). Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { auditAdvisories } from "../src/internal/auditAdvisories.ts";

const run = { seed: 1337, numRuns: 50 };

type Adv = Record<string, unknown>;
const adv = (id: number, over: Adv = {}): Adv => ({
  id,
  module_name: `mod${id}`,
  severity: "high",
  title: `title ${id}`,
  url: `https://example.test/${id}`,
  vulnerable_versions: "<1.0.0",
  patched_versions: ">=1.0.0",
  ...over,
});
const doc = (advisories: Record<string, unknown>, metadata: unknown = { vulnerabilities: { high: 1 } }): string =>
  JSON.stringify({ advisories, metadata });

describe("auditAdvisories", () => {
  test("auditAdvisories maps each field to its name, ordered by id", () => {
    const text = doc({ b: adv(30), a: adv(7), c: adv(12) });
    expect(auditAdvisories(text)).toEqual([
      {
        id: 7,
        module: "mod7",
        severity: "high",
        title: "title 7",
        url: "https://example.test/7",
        vulnerable: "<1.0.0",
        patched: ">=1.0.0",
      },
      {
        id: 12,
        module: "mod12",
        severity: "high",
        title: "title 12",
        url: "https://example.test/12",
        vulnerable: "<1.0.0",
        patched: ">=1.0.0",
      },
      {
        id: 30,
        module: "mod30",
        severity: "high",
        title: "title 30",
        url: "https://example.test/30",
        vulnerable: "<1.0.0",
        patched: ">=1.0.0",
      },
    ]);
  });

  test("each field is its own: distinct values land in the field of the same meaning", () => {
    const got = auditAdvisories(
      doc({
        x: adv(1, {
          module_name: "M",
          severity: "S",
          title: "T",
          url: "U",
          vulnerable_versions: "V",
          patched_versions: "P",
        }),
      }),
    );
    expect(got).toEqual([{ id: 1, module: "M", severity: "S", title: "T", url: "U", vulnerable: "V", patched: "P" }]);
  });

  test("an audit with no advisories is an empty list, not undefined", () => {
    expect(auditAdvisories(doc({}, { vulnerabilities: {} }))).toEqual([]);
  });

  test("absent text and text that is not JSON are undefined", () => {
    expect(auditAdvisories(undefined)).toBeUndefined();
    expect(auditAdvisories("")).toBeUndefined();
    expect(auditAdvisories("{not json")).toBeUndefined();
  });

  test("a document that is not an object with advisories and metadata.vulnerabilities is undefined", () => {
    const a = { x: adv(1) };
    for (const text of [
      "null",
      "[]",
      "3",
      '"s"',
      JSON.stringify({}),
      JSON.stringify({ advisories: a }),
      JSON.stringify({ metadata: { vulnerabilities: {} } }),
      JSON.stringify({ advisories: [], metadata: { vulnerabilities: {} } }),
      JSON.stringify({ advisories: a, metadata: [] }),
      JSON.stringify({ advisories: a, metadata: {} }),
      JSON.stringify({ advisories: a, metadata: { vulnerabilities: [] } }),
      JSON.stringify({ advisories: a, metadata: { vulnerabilities: 1 } }),
      JSON.stringify({ advisories: a, metadata: null }),
    ])
      expect(auditAdvisories(text), text).toBeUndefined();
  });

  test("an advisory with a missing or mistyped id or text field makes the whole document undefined", () => {
    const bad: unknown[] = [
      adv(1, { id: "1" }),
      adv(1, { id: 1.5 }),
      adv(1, { id: undefined }),
      adv(1, { id: null }),
      "x",
    ];
    for (const f of ["module_name", "severity", "title", "url", "vulnerable_versions", "patched_versions"]) {
      bad.push(adv(1, { [f]: undefined }), adv(1, { [f]: 5 }), adv(1, { [f]: null }));
    }
    for (const b of bad) expect(auditAdvisories(doc({ good: adv(2), b })), JSON.stringify(b)).toBeUndefined();
    expect(auditAdvisories(doc({ a: null }))).toBeUndefined();
  });

  test("empty strings are text: an advisory whose fields are all empty is kept", () => {
    const got = auditAdvisories(
      doc({
        a: adv(4, { module_name: "", severity: "", title: "", url: "", vulnerable_versions: "", patched_versions: "" }),
      }),
    );
    expect(got).toEqual([{ id: 4, module: "", severity: "", title: "", url: "", vulnerable: "", patched: "" }]);
  });

  test("property: any set of distinct integer ids comes back ascending, one entry each", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.integer({ min: -1000, max: 100000 }), { maxLength: 12 }), (ids) => {
        const advisories = Object.fromEntries(ids.map((id, i) => [`k${i}`, adv(id)]));
        const got = auditAdvisories(doc(advisories));
        expect(got?.map((a) => a.id)).toEqual([...ids].sort((x, y) => x - y));
        for (const a of got ?? []) expect(a.module).toBe(`mod${a.id}`);
      }),
      run,
    );
  });
});
