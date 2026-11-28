// Spec: k.ledger, clause "A `.keel/monitored.json` naming `todos.editor.save` with runs 3 gives `monitored` evidence to the export whose file holds `'todos.editor'` and to no other; a file failing its shape is E1711."
// k.ledger, Rules "E1711 `.keel/monitored.json` fails its shape".
// The real `keel` binary over a temp project (OS tmpdir). Seed: 1337 (no property in this file).
import { fixedTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";
import { diags, evidenceText, ledgerRecord, withProject } from "./ledger-fixture-kinds.ts";
import { keel, summaryOf } from "./test-sim-project.ts";

const MONITORED = ".keel/monitored.json";
const EDITOR_FILE = "packages/app/src/editor.ts";
const OTHER_FILE = "packages/app/src/other.ts";
const ROOT_FILE = "packages/app/src/root.ts";
const EDITOR = `${EDITOR_FILE}#editorChart`;
const OTHER = `${OTHER_FILE}#otherChart`;
const ROOT = `${ROOT_FILE}#rootChart`;

const app: Record<string, string> = {
  [EDITOR_FILE]: "export const editorChart = { id: 'todos.editor' };\n",
  [OTHER_FILE]: "export const otherChart = { id: 'todos.other' };\n",
  [ROOT_FILE]: "export const rootChart = { id: 'todos' };\n",
};

const tally = (tx: Record<string, unknown>): string =>
  JSON.stringify({ v: 1, origin: "https://app.example", from: 0, to: 60000, tx });

describe("k.ledger: production evidence from `.keel/monitored.json`", () => {
  it(
    "A `.keel/monitored.json` naming `todos.editor.save` with runs 3 gives `monitored` evidence to the export whose file holds `'todos.editor'` and to no other; a file failing its shape is E1711.",
    () => {
      const run = withProject("ledger-monitored", { ...app, [MONITORED]: tally({ "todos.editor.save": 3 }) }, (dir) =>
        keel(dir, ["ledger"]),
      );
      const editor = ledgerRecord(run, EDITOR);
      expect(editor?.rung).toBe("monitored");
      expect(evidenceText(editor)).toContain("3");
      expect(evidenceText(editor)).toContain("60000");
      expect(ledgerRecord(run, OTHER)?.rung).not.toBe("monitored");
      expect(ledgerRecord(run, ROOT)?.rung).not.toBe("monitored");
      expect(diags(run, "E1711")).toEqual([]);
    },
    fixedTime(60_000),
  );

  it(
    "a transaction with runs 0 gives no `monitored` evidence",
    () => {
      const run = withProject(
        "ledger-monitored-zero",
        { ...app, [MONITORED]: tally({ "todos.editor.save": 0 }) },
        (dir) => keel(dir, ["ledger"]),
      );
      expect(ledgerRecord(run, EDITOR)?.rung).not.toBe("monitored");
    },
    fixedTime(60_000),
  );

  it(
    "only the longest dotted prefix of the transaction name that a file holds counts, not a shorter one",
    () => {
      const run = withProject(
        "ledger-monitored-prefix",
        { ...app, [MONITORED]: tally({ "todos.editor.save": 3 }) },
        (dir) => keel(dir, ["ledger"]),
      );
      expect(ledgerRecord(run, ROOT)?.rung).not.toBe("monitored");
      expect(ledgerRecord(run, EDITOR)?.rung).toBe("monitored");
    },
    fixedTime(60_000),
  );

  it.each([
    ["not JSON", "{ nope"],
    [
      "`v` other than 1",
      JSON.stringify({ v: 2, origin: "https://app.example", from: 0, to: 1, tx: { "todos.editor.save": 3 } }),
    ],
    ["no `tx`", JSON.stringify({ v: 1, origin: "https://app.example", from: 0, to: 1 })],
    ["a non-numeric run count", tally({ "todos.editor.save": "three" })],
  ])(
    "E1711: a `.keel/monitored.json` that is %s fails its shape and adds nothing",
    (_label, text) => {
      const run = withProject("ledger-monitored-bad", { ...app, [MONITORED]: text }, (dir) => keel(dir, ["ledger"]));
      expect(diags(run, "E1711")).toHaveLength(1);
      expect(ledgerRecord(run, EDITOR)?.rung).not.toBe("monitored");
      expect(summaryOf(run)).toBeDefined();
    },
    fixedTime(60_000),
  );
});
