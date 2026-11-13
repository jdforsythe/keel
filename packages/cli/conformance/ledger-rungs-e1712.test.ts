// Spec: k.ledger, clause "With a committed ledger whose `rungs.monitored` is 1, removing `.keel/monitored.json` makes `--diff` report E1712."
// Spec: k.ledger, Rules "E1712 `--diff` without `--scope`: a rung the committed `rungs` counts above 0 is held by no item".
// The real `keel` binary over a temp project (OS tmpdir). The committed ledger is the one `keel ledger --write` stores
// at `.keel/ledger.json` while `.keel/monitored.json` gives one export `monitored`. Seed: 1337 (no property in this file).
import { describe, expect, it } from "vitest";
import { diags, readJson, withProject } from "./ledger-fixture-kinds.ts";
import { keel, removeFile, summaryOf } from "./test-sim-project.ts";

const COMMITTED = ".keel/ledger.json";
const MONITORED = ".keel/monitored.json";
const files: Record<string, string> = {
  "packages/app/src/editor.ts": "export const editorChart = { id: 'todos.editor' };\n",
  [MONITORED]: JSON.stringify({
    v: 1,
    origin: "https://app.example",
    from: 0,
    to: 60000,
    tx: { "todos.editor.save": 3 },
  }),
};

describe("k.ledger: `keel ledger --diff` and a rung no item holds (E1712)", () => {
  it("With a committed ledger whose `rungs.monitored` is 1, removing `.keel/monitored.json` makes `--diff` report E1712.", () => {
    withProject("ledger-e1712", files, (dir) => {
      const written = keel(dir, ["ledger", "--write", COMMITTED]);
      expect(written.status).toBe(0);
      const committed = readJson(dir, COMMITTED);
      expect(committed).toMatchObject({ rungs: { monitored: 1 } });

      const before = keel(dir, ["ledger", "--diff"]);
      expect(diags(before, "E1712")).toEqual([]);
      expect(before.status).toBe(0);

      removeFile(dir, MONITORED);
      const after = keel(dir, ["ledger", "--diff"]);
      expect(after.status).toBe(1);
      expect(diags(after, "E1712")).toHaveLength(1);
      expect(summaryOf(after)).toMatchObject({ ok: false });
    });
  }, 60_000);
});
