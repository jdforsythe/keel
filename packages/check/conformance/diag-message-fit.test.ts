// Spec: k.check, clause "For each code `reportedCodes()` lists, every diagnostic of that code its fixture reports has a message of at most 89 UTF-16 code units that does not end in `...`."
// Seed n/a: the fixtures are the table in fixtures-by-code.ts (`bad`, with its options), and for E1756 a registered rule that throws (as explain-and-fixture-per-code.test.ts); no generated input.
// ASSUMPTION: "its fixture" is the code's entry in fixtures-by-code.ts. The W codes `reportedCodes()` lists (W1012, W1018, W1564, W1723: W1005 is reserved and listed no more, W1018 is `keel check`'s warning for a view it cannot write) have no entry there and no fixture in this folder: UNTESTABLE for want of a fixture, named by the last test so the gap shows.
import { fixedTime } from "@keel/tooling/test-time";
import { check, defineRule, reportedCodes } from "@keel/check";
import { describe, expect, test } from "vitest";
import { CODE_FIXTURES } from "./fixtures-by-code.ts";

const THROWS = "throws.ts";
/** The code of the throwing rule registered for E1756's fixture; it has no fixture of its own and is left out of `codes`. */
const OWN_RULE = "E2957";
defineRule({
  code: OWN_RULE,
  message: "throws on one path",
  see: "k.check",
  explain: "A rule that throws on throws.ts, for the E1756 fixture of the message-fit clause.",
  check: ({ file }) => {
    if (file.path === THROWS) throw new Error("boom");
    return [];
  },
});

const codes = reportedCodes().filter((c) => c !== OWN_RULE);
const fits = (found: readonly { readonly message: string }[]): void => {
  for (const d of found) {
    expect(d.message.length, d.message).toBeLessThanOrEqual(89);
    expect(d.message.endsWith("..."), d.message).toBe(false);
  }
};

describe("k.check: a diagnostic's message fits", () => {
  for (const code of codes.filter((c) => CODE_FIXTURES[c] !== undefined)) {
    test(
      `${code}: every diagnostic of that code its fixture reports has a message of at most 89 UTF-16 code units that does not end in \`...\``,
      () => {
        const fx = CODE_FIXTURES[code];
        if (fx === undefined) throw new Error(`no fixture for ${code}`);
        const found = check(fx.bad, fx.badOpts ?? fx.opts ?? {}).diagnostics.filter((d) => d.code === code);
        expect(found.length, `${code} fixture reports it`).toBeGreaterThan(0);
        fits(found);
      },
      fixedTime(60_000),
    );
  }

  test(
    "E1756: every diagnostic its fixture (a registered rule that throws) reports has a message of at most 89 UTF-16 code units that does not end in `...`",
    () => {
      const found = check([{ path: THROWS, source: "export const throws = 1\n" }]).diagnostics.filter(
        (d) => d.code === "E1756",
      );
      expect(found.length).toBeGreaterThan(0);
      fits(found);
    },
    fixedTime(60_000),
  );

  test("UNTESTABLE for want of a fixture: the codes `reportedCodes()` lists with no fixture here are only W1012, W1018, W1564 and W1723", () => {
    const unfixtured = codes.filter((c) => c !== "E1756" && CODE_FIXTURES[c] === undefined);
    expect(unfixtured).toEqual(["W1012", "W1018", "W1564", "W1723"]);
  });
});
