// Spec: k.ledger, clause "Lowering an item's rung below the committed ledger makes `keel ledger --diff` report E1706."
// k.ledger, Rules "E1706 ledger rung lower than committed, or unsafe count higher".
// The real `keel` binary over a temp project (OS tmpdir). The committed ledger is the one `keel ledger --write`
// stores at `.keel/ledger.json` while the export is `probabilistic` with no unsafe call; `--diff` reads it back.
// Property seed: 1337 (in the fixture).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  EXAMPLE,
  ITEM,
  PROPERTY,
  SEEDED_100,
  SOURCE,
  UNSAFE,
  exampleTest,
  propertyTest,
  source,
  unsafeSource,
} from "./ledger-fixture.ts";
import {
  type Run,
  childOutput,
  keel,
  makeProject,
  removeFile,
  removeProject,
  summaryOf,
  writeFiles,
} from "./test-sim-project.ts";

const COMMITTED = ".keel/ledger.json";
let dir = "";

beforeAll(() => {
  dir = makeProject("ledger-diff", { [SOURCE]: source, [EXAMPLE]: exampleTest, [PROPERTY]: propertyTest(SEEDED_100) });
  const written = keel(dir, ["ledger", "--write", COMMITTED]);
  if (written.status !== 0)
    throw new Error(`keel ledger --write failed (status ${String(written.status)}): ${childOutput(written)}`);
}, 60_000);
afterAll(() => {
  removeProject(dir);
});

const e1706 = (run: Run): unknown[] => run.records.filter((r) => r.kind === "diag" && r.code === "E1706");

describe("k.ledger: `keel ledger --diff` against the committed ledger", () => {
  it("the stored ledger holds the export at `probabilistic`", () => {
    const led = keel(dir, ["ledger"]);
    expect(led.records.find((r) => r.item === ITEM)?.rung).toBe("probabilistic");
  }, 60_000);

  it("no regression: `--diff` is ok, exit 0, no E1706", () => {
    const diff = keel(dir, ["ledger", "--diff"]);
    expect(diff.status).toBe(0);
    expect(e1706(diff)).toEqual([]);
    expect(summaryOf(diff)).toMatchObject({ ok: true });
  }, 60_000);

  it("lowering the export's rung (property removed: probabilistic -> example) reports E1706, exit 1", () => {
    removeFile(dir, PROPERTY);
    const diff = keel(dir, ["ledger", "--diff"]);
    writeFiles(dir, { [PROPERTY]: propertyTest(SEEDED_100) });
    expect(diff.status).toBe(1);
    expect(e1706(diff)).toEqual([
      expect.objectContaining({ code: "E1706", path: SOURCE, message: expect.stringContaining(ITEM) }),
    ]);
    expect(e1706(diff)).toEqual([
      expect.objectContaining({ message: expect.stringContaining("probabilistic -> example") }),
    ]);
    expect(summaryOf(diff)).toMatchObject({ ok: false });
  }, 60_000);

  it.each([
    ["unsafe(...)", false],
    ["unsafe<T>(...)", true],
  ])(
    "a higher unsafe count than the committed ledger (one %s call) reports E1706, exit 1",
    (_label, typed) => {
      writeFiles(dir, { [UNSAFE]: unsafeSource(typed) });
      const diff = keel(dir, ["ledger", "--diff"]);
      removeFile(dir, UNSAFE);
      expect(diff.status).toBe(1);
      expect(e1706(diff)).toEqual([
        expect.objectContaining({ code: "E1706", message: expect.stringContaining("unsafe count up 0 -> 1") }),
      ]);
      expect(summaryOf(diff)).toMatchObject({ ok: false });
    },
    60_000,
  );

  it("restored to the committed state, `--diff` is ok again", () => {
    const diff = keel(dir, ["ledger", "--diff"]);
    expect(diff.status).toBe(0);
    expect(e1706(diff)).toEqual([]);
  }, 60_000);
});
