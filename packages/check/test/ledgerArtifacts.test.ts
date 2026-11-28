// k.compiler E1005 beside k.ledger: the ledger's own `.keel/` files are not compiler artifacts and are never E1005.
import { describe, expect, it } from "vitest";
import { generatedEdits } from "../src/internal/generatedEdits.ts";

const f = (path: string, source: string) => ({ path, source });
const tally = JSON.stringify({
  v: 1,
  origin: "http://localhost:4173",
  from: 0,
  to: 60000,
  tx: { "todos.editor.save": 3 },
});

describe("generatedEdits and ledger files", () => {
  it("`.keel/monitored.json` and `.keel/ledger.json` are not checked; another unknown name is still E1005", () => {
    const out = generatedEdits(
      [
        f("apps/a/.keel/monitored.json", tally),
        f(".keel/ledger.json", '{"version":1}'),
        f("apps/a/.keel/x.json", "{}"),
      ],
      () => ({}),
      undefined,
    );
    expect(out.map((d) => [d.code, d.path])).toEqual([["E1005", "apps/a/.keel/x.json"]]);
  });
});
