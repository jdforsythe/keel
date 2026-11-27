// testResults: an E1729 failure's `fix` shows the two trace entries that differ (k.drive-law Law check), with the
// fields that can hold a person's data (`value`, `href`, `event`) shown as their type and size, never their text.
// Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { testResults } from "../src/index.ts";

const SEED = 1337;
const CWD = "/repo/pkg";
const failure = (a: string, b: string) => ({
  file: { filepath: "/repo/pkg/test/a.test.ts" },
  tasks: [
    {
      type: "test",
      name: "posts",
      result: {
        state: "fail",
        errors: [
          {
            code: "E1729",
            message: `E1729 two replays of the run differ at trace entry 31\n${a}\n${b}`,
            stack: "Error\n    at /repo/pkg/test/a.test.ts:5:3",
          },
        ],
      },
    },
  ],
});
const fixOf = (a: string, b: string): string => testResults([failure(a, b)], [], CWD).diagnostics[0]?.fix ?? "";

describe("testResults of an E1729", () => {
  it("names the recorded and the replayed entry and hides the text of a value", () => {
    const a = JSON.stringify({ kind: "storage", key: "keel.store.sa.notes", value: '{"items":["ada@example.com"]}' });
    const b = JSON.stringify({ kind: "storage", key: "keel.store.sa.notes", value: '{"items":["bob@example.com"]}' });
    const fix = fixOf(a, b);
    expect(fix).toContain('recorded: {"kind":"storage","key":"keel.store.sa.notes","value":"<string 29>"}');
    expect(fix).toContain('replayed: {"kind":"storage","key":"keel.store.sa.notes","value":"<string 29>"}');
    expect(fix).not.toContain("example.com");
  });

  it("keeps the moment, the codes and the ids of an entry and hides every other field's text, clipped", () => {
    const text = fc.stringMatching(/^[0-9][a-z0-9 ]{7,30}$/);
    fc.assert(
      fc.property(text, text, fc.nat(1e6), (secret, other, at) => {
        const a = JSON.stringify({
          kind: "event",
          at,
          event: { kind: "fire", id: "x.save", event: { value: secret } },
        });
        const b = JSON.stringify({ kind: "store", id: "x.notes", value: other, extra: secret });
        const fix = fixOf(a, b);
        expect(fix).toContain(`"at":${at}`);
        expect(fix).toContain('"id":"x.notes"');
        expect(fix).not.toContain(secret);
        expect(fix).not.toContain(other);
        for (const line of fix.split("\n")) expect(line.length).toBeLessThanOrEqual(512);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("shows a missing entry as null and tolerates a line that is not JSON", () => {
    const fix = fixOf("null", "not json");
    expect(fix).toContain("recorded: null");
    expect(fix).toContain("replayed: <text 8>");
  });
});

describe("testResults of an E1704 from properties", () => {
  it("carries the shrunk inputs in `fix`, so the generated props that failed are named", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z0-9]{1,12}$/), (id) => {
        const message = `E1704 component: E1703 axe-core rule duplicate-id-aria threw: Failed to execute 'que... (seed 1337, run 1, shrunk)\n  props: {"id":"${id}"}`;
        const file = {
          file: { filepath: "/repo/pkg/test/a.test.ts" },
          tasks: [
            {
              type: "test",
              name: "t",
              result: {
                state: "fail",
                errors: [{ code: "E1704", message, stack: "Error\n    at /repo/pkg/test/a.test.ts:5:3" }],
              },
            },
          ],
        };
        const fix = testResults([file], [], CWD).diagnostics[0]?.fix ?? "";
        expect(fix.split("\n")).toContain(`props: {"id":"${id}"}`);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});
