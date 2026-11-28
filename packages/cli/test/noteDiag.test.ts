// A build step's Keel-coded line as a diagnostic record (OUTPUT.md): E1819 carries `see` k.gamut (k.gamut CSS).
import { describe, expect, it } from "vitest";
import { noteDiag } from "../src/internal/noteDiag.ts";

describe("noteDiag", () => {
  it("reads the code, a path word and the message, and gives E1819 its section", () => {
    expect(noteDiag("E1006 modules/a/a.contract.ts failed to evaluate: boom\n")).toEqual({
      kind: "diag",
      code: "E1006",
      path: "modules/a/a.contract.ts",
      message: "failed to evaluate: boom",
    });
    expect(noteDiag("E1819 --k-color-a is #00857f in assets/entry.js; Keel's CSS ships in .css files")).toEqual({
      kind: "diag",
      code: "E1819",
      message: "--k-color-a is #00857f in assets/entry.js; Keel's CSS ships in .css files",
      see: "k.gamut",
    });
    expect(noteDiag("error during build:")).toBeUndefined();
  });
});
