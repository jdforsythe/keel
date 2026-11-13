// Spec: k.evidence, Conformance "`pii.json` lists every `.pii()` path of the fixture's schema exports with its class; `coverage` is 1 when every sink clause is `probabilistic` or higher, and drops when one is lower."
// Seed: 1337. ASSUMED path text: array items are `*` and a marked object covers every leaf under it (k.privacy `piiPaths`),
// compared as dotted text whether `pii.json` writes the path as a string or as an array. Each sink clause is cited by a
// 100-run seeded property (`probabilistic`) or by one example (`example`) in the fixture project.
import { rmSync } from "node:fs";
import { afterAll, describe, expect, test } from "vitest";
import {
  PII_VALUES,
  SINK_CLAUSES,
  TEST_KEY_PEM,
  USER_PII,
  collect,
  fixtureTree,
  parseJson,
  pathText,
  project,
  readTree,
  removeDir,
  writeBundle,
} from "./evidence-fixture.ts";

const SLOW = 600_000;
const cleanups: string[] = [];
afterAll(() => {
  for (const d of cleanups) rmSync(d, { recursive: true, force: true });
});

const ACCOUNT = `import { s } from "@keel/schema";

export const Account = s.object({
  holder: s.object({ first: s.string(), last: s.string() }).pii("name"),
  tags: s.array(s.string().pii("content")),
  plan: s.string(),
});
`;
/** Account's marked leaves: every leaf under the marked object, array items as `*`. */
const ACCOUNT_PII = [
  { path: "holder.first", class: "name" },
  { path: "holder.last", class: "name" },
  { path: "tags.*", class: "content" },
];

const piiOf = (out: string): unknown => parseJson(readTree(out).get("pii.json"));
const coverageOf = (pii: unknown): unknown =>
  typeof pii === "object" && pii !== null && "coverage" in pii ? pii.coverage : undefined;

describe("k.evidence: pii.json paths and coverage", () => {
  test(
    "`pii.json` lists every `.pii()` path of the fixture's schema exports with its class",
    () => {
      const dir = project(fixtureTree({ extra: { "modules/a/Account.schema.ts": ACCOUNT } }));
      const { out, base } = writeBundle(dir, TEST_KEY_PEM);
      cleanups.push(dir, base);
      const entries = collect(piiOf(out), ["file", "export", "path", "class"]);
      const listed = (name: string) =>
        entries
          .filter((e) => e.export === name)
          .map((e) => ({ path: pathText(e.path), class: String(e.class) }))
          .sort((a, b) => a.path.localeCompare(b.path));
      const sorted = (xs: readonly { path: string; class: string }[]) =>
        [...xs].sort((a, b) => a.path.localeCompare(b.path));
      expect(listed("User")).toEqual(sorted(USER_PII));
      expect(listed("Account")).toEqual(sorted(ACCOUNT_PII));
      for (const e of entries) expect(String(e.file)).toMatch(/\.schema\.ts$/);
      expect(JSON.stringify(piiOf(out))).not.toContain(PII_VALUES.name);
    },
    SLOW,
  );

  test(
    "`coverage` is 1 when every sink clause is `probabilistic` or higher",
    () => {
      const dir = project(fixtureTree());
      const { out, base } = writeBundle(dir, TEST_KEY_PEM);
      cleanups.push(dir, base);
      expect(coverageOf(piiOf(out))).toBe(1);
    },
    SLOW,
  );

  test(
    "`coverage` drops when one sink clause is lower than `probabilistic`",
    () => {
      for (const lowered of SINK_CLAUSES) {
        const probabilisticSinks = SINK_CLAUSES.filter((c) => c.id !== lowered.id).map((c) => c.id);
        const dir = project(fixtureTree({ probabilisticSinks }));
        const { out, base } = writeBundle(dir, TEST_KEY_PEM);
        cleanups.push(dir, base);
        const coverage = coverageOf(piiOf(out));
        expect(typeof coverage, lowered.id).toBe("number");
        expect(Number(coverage), lowered.id).toBeLessThan(1);
        expect(Number(coverage), lowered.id).toBeCloseTo(0.75, 2);
      }
    },
    SLOW,
  );

  test(
    "`pii.json` names each sink's clause: `std.sessions#2`, `k.privacy#7`, `k.privacy#6`, `k.evidence#5`",
    () => {
      const dir = project(fixtureTree());
      const { out, base } = writeBundle(dir, TEST_KEY_PEM);
      cleanups.push(dir, base);
      const text = JSON.stringify(piiOf(out));
      for (const c of SINK_CLAUSES) expect(text, c.id).toContain(c.id);
    },
    SLOW,
  );
});
