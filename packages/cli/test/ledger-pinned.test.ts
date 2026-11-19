// Ledger items take evidence through a relative import only from the file it resolves to (k.ledger).
import { describe, expect, it } from "vitest";
import { buildLedger } from "../src/internal/buildLedger.ts";

const file = (path: string, source: string) => ({ path, source });

describe("buildLedger: names pinned by relative imports", () => {
  it("a test of api/board.ts gives no evidence to digest/board.service.ts#board; an index re-export reaches by name", () => {
    const { items } = buildLedger([
      file("apps/g/modules/api/board.ts", "export const board = 1;\n"),
      file("apps/g/modules/digest/board.service.ts", "export const board = 2;\n"),
      file(
        "apps/g/test/board.test.ts",
        'import { board } from "../modules/api/board.ts";\nit("t", () => { board; });\n',
      ),
      file("packages/p/src/a.ts", "export function a() {}\n"),
      file("packages/p/src/index.ts", 'export { a } from "./a.ts";\n'),
      file("packages/p/test/a.test.ts", 'import { a } from "../src/index.ts";\nit("t", () => { a(); });\n'),
    ]);
    const rung = (item: string) => items.find((i) => i.item === item)?.evidence.length;
    expect(rung("g:api/board.ts#board")).toBe(1);
    expect(rung("g:digest/board.service.ts#board")).toBe(0);
    expect(rung("packages/p/src/a.ts#a")).toBe(1);
  });
});
