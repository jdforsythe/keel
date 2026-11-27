// Spec: k.create, clause "`create-app "My Site"`, `create-app shop --name vite` and `create-app shop --library charts` are each E1352 with no path: in compact the line starts `E1352 ` followed by the message, with no `path:line:col`."
// RFC 0247, Conformance (after the second review): `create-app "My Site"`, `create-app shop --name vite` and `create-app shop --library charts` are each E1352 with no path (compact: the line starts `E1352 ` followed by the message, no `path:line:col`).
// seed 1337 (property over names that break the name rule). The bin as a child process (create-bin-support.ts).
// ASSUMED: "no path" in json is a diag record whose `path` is absent or empty; `--format=json` is accepted by the bin as `keel` accepts it.
import { testTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { SEED, cleanAll, entries, records, run, sandbox } from "./create-bin-support.ts";

const T = testTime(120_000);
afterAll(cleanAll);

const e1352Lines = (out: string): string[] => out.split("\n").filter((l) => l.includes("E1352"));
/** `E1352 ` at the start of the line, then a message that does not open with `path:line:col`. */
const bareLine = /^E1352 (?!\S+:\d+:\d+(\s|$))\S/;

const cases: [string, string[]][] = [
  ['create-app "My Site"', ["My Site"]],
  ["create-app shop --name vite", ["shop", "--name", "vite"]],
  ["create-app shop --library charts", ["shop", "--library", "charts"]],
];

describe("k.create Names: E1352 names no path", () => {
  for (const [label, args] of cases) {
    it(
      `${label} is E1352 whose compact line starts \`E1352 \` followed by the message, with no path:line:col`,
      async () => {
        const cwd = sandbox();
        const r = await run([...args, "--format=compact"], cwd);
        expect(r.status).toBe(1);
        const lines = e1352Lines(r.out);
        expect(lines.length, r.out).toBeGreaterThan(0);
        expect(lines[0]).toMatch(bareLine);
        expect(entries(cwd)).toEqual([]);
      },
      T,
    );

    it(
      `${label} in json is a diag record for E1352 with no path`,
      async () => {
        const cwd = sandbox();
        const r = await run([...args, "--format=json"], cwd);
        expect(r.status).toBe(1);
        const diag = records(r.stdout).find((x) => x.kind === "diag" && x.code === "E1352");
        expect(diag, r.out).toBeDefined();
        const path = diag?.path;
        expect(path === undefined || path === "", JSON.stringify(diag)).toBe(true);
      },
      T,
    );
  }

  it(
    "for any folder name that breaks the name rule, E1352 names no path",
    async () => {
      const bad = fc.stringMatching(/^[A-Z][A-Za-z]{2,8}$/);
      const names = fc.sample(bad, { seed: SEED, numRuns: 4 });
      for (const n of names) {
        const cwd = sandbox();
        const r = await run([n, "--format=compact"], cwd);
        expect(r.status, n).toBe(1);
        const lines = e1352Lines(r.out);
        expect(lines[0], r.out).toMatch(bareLine);
      }
    },
    T * 2,
  );
});
