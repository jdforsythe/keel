// piiReport (k.evidence pii.json, k.privacy Personal data): each marked leaf of the project's schema exports, each
// sink with its clause's rung, and the coverage. Seed 1337.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";
import { piiReport } from "../src/internal/piiReport.ts";
import type { SourceFile } from "../src/types/SourceFile.ts";

const run = { seed: 1337, numRuns: 50 };
const here = fileURLToPath(new URL(".", import.meta.url));
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
type Rung = "none" | "monitored" | "example" | "probabilistic" | "exhaustive" | "proven";
const project = (files: Record<string, string>): { dir: string; files: SourceFile[] } => {
  const dir = mkdtempSync(join(here, ".tmp-piiReport-"));
  dirs.push(dir);
  for (const [path, source] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), source);
  }
  return { dir, files: Object.entries(files).map(([path, source]) => ({ path, source })) };
};

const USER = `import { s } from "@keel/schema";
export const User = s.object({
  name: s.string().pii("name"),
  email: s.string().pii("contact"),
  addresses: s.array(s.object({ street: s.string().pii("location") })),
  age: s.int(),
});
export const Plain = s.object({ n: s.int() });
export const notASchema = 3;
`;
const SINKS = [
  ["sessions", "std.sessions#2"],
  ["inputs", "k.privacy#7"],
  ["log", "k.privacy#6"],
  ["bundle", "k.evidence#5"],
] as const;
const all = (r: Rung) => (): Rung => r;

describe("piiReport", () => {
  test("piiReport reads every marked leaf of each schema export, exports in name order, files in the order given", async () => {
    const p = project({
      "modules/a/user.schema.ts": USER,
      "modules/b/team.schema.ts": `import { s } from "@keel/schema";\nexport const Team = s.object({ lead: s.string().pii("name") });\nexport const Alpha = s.object({ x: s.string().pii("contact") });\n`,
    });
    const r = await piiReport(p.dir, p.files, all("proven"));
    expect(r.v).toBe(1);
    expect(r.unread).toEqual([]);
    expect(r.paths).toEqual([
      { file: "modules/a/user.schema.ts", export: "User", path: "name", class: "name" },
      { file: "modules/a/user.schema.ts", export: "User", path: "email", class: "contact" },
      { file: "modules/a/user.schema.ts", export: "User", path: "addresses.*.street", class: "location" },
      { file: "modules/b/team.schema.ts", export: "Alpha", path: "x", class: "contact" },
      { file: "modules/b/team.schema.ts", export: "Team", path: "lead", class: "name" },
    ]);
  });

  test("only files named *.schema.ts count, and not those under test, conformance or node_modules", async () => {
    const p = project({
      "user.schema.ts": USER,
      "user.ts": USER,
      "user.schema.tsx": USER,
      "xschema.ts": USER,
      "test/t.schema.ts": USER,
      "a/test/t.schema.ts": USER,
      "conformance/c.schema.ts": USER,
      "node_modules/m/m.schema.ts": USER,
      "latest/z.schema.ts": USER,
    });
    const r = await piiReport(p.dir, p.files, all("none"));
    expect([...new Set(r.paths.map((x) => x.file))]).toEqual(["user.schema.ts", "latest/z.schema.ts"]);
    expect(r.unread).toEqual([]);
  });

  test("a schema file that fails to import is named in unread, never skipped silently; others still read", async () => {
    const p = project({
      "bad.schema.ts": 'throw new Error("boom");\n',
      "user.schema.ts": USER,
      "worse.schema.ts": 'export const X = (await Promise.reject(new Error("x")));\n',
    });
    const r = await piiReport(p.dir, p.files, all("none"));
    expect(r.unread).toEqual(["bad.schema.ts", "worse.schema.ts"]);
    expect(r.paths).toHaveLength(3);
    const listed = project({});
    const absent = await piiReport(listed.dir, [{ path: "gone.schema.ts", source: "" }], all("none"));
    expect(absent.unread).toEqual(["gone.schema.ts"]);
  });

  test("the sinks are the four k.privacy sinks in order, each with the rung rungOf gives its clause", async () => {
    const p = project({ "user.schema.ts": USER });
    const asked: string[] = [];
    const r = await piiReport(p.dir, p.files, (c) => {
      asked.push(c);
      return c === "k.privacy#7" ? "example" : "proven";
    });
    expect(r.sinks).toEqual([
      { sink: "sessions", clause: "std.sessions#2", rung: "proven" },
      { sink: "inputs", clause: "k.privacy#7", rung: "example" },
      { sink: "log", clause: "k.privacy#6", rung: "proven" },
      { sink: "bundle", clause: "k.evidence#5", rung: "proven" },
    ]);
    expect(asked.sort()).toEqual(SINKS.map((s) => s[1]).sort());
  });

  test("coverage is the share of sinks at probabilistic or higher, over a project with paths", async () => {
    const p = project({ "user.schema.ts": USER });
    const cover = async (rungs: Rung[]) =>
      (await piiReport(p.dir, p.files, (c) => rungs[SINKS.findIndex((s) => s[1] === c)] ?? "none")).coverage;
    expect(await cover(["proven", "proven", "proven", "proven"])).toBe(1);
    expect(await cover(["proven", "exhaustive", "probabilistic", "probabilistic"])).toBe(1);
    expect(await cover(["proven", "proven", "proven", "example"])).toBe(0.75);
    expect(await cover(["monitored", "none", "example", "none"])).toBe(0);
    expect(await cover(["probabilistic", "none", "none", "none"])).toBe(0.25);
    expect(await cover(["none", "none", "monitored", "exhaustive"])).toBe(0.25);
  });

  test("with no marked path the coverage is 1 whatever the rungs, and the sinks still list their rungs", async () => {
    const p = project({
      "plain.schema.ts": 'import { s } from "@keel/schema";\nexport const P = s.object({ n: s.int() });\n',
    });
    const r = await piiReport(p.dir, p.files, all("none"));
    expect(r.paths).toEqual([]);
    expect(r.coverage).toBe(1);
    expect(r.sinks.map((s) => s.rung)).toEqual(["none", "none", "none", "none"]);
    const empty = await piiReport(p.dir, [], all("none"));
    expect(empty).toEqual({ v: 1, paths: [], sinks: r.sinks, coverage: 1, unread: [] });
  });

  test("property: coverage is the number of covered sinks over four, whatever the rung of each", async () => {
    const p = project({ "user.schema.ts": USER });
    const rung = fc.constantFrom<Rung>("none", "monitored", "example", "probabilistic", "exhaustive", "proven");
    await fc.assert(
      fc.asyncProperty(fc.array(rung, { minLength: 4, maxLength: 4 }), async (rungs) => {
        const r = await piiReport(p.dir, p.files, (c) => rungs[SINKS.findIndex((s) => s[1] === c)] ?? "none");
        const covered = rungs.filter((x) => ["probabilistic", "exhaustive", "proven"].includes(x)).length;
        expect(r.coverage).toBe(covered / 4);
        expect(r.sinks.map((s) => s.rung)).toEqual(rungs);
      }),
      { ...run, numRuns: 30 },
    );
  });
});
