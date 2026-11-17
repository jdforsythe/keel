// @vitest-environment node
// k.privacy Server log: below the scrub's caps a `diag` record's message, its server prefix included, and each frame
// are scrubbed whole; past a cap the prefix (`lead`) is kept, the rest of the message is one mark, and each frame is one
// mark. A record without a prefix, or whose message does not start with it, is one mark whole. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { holdSecrets } from "../src/internal/holdSecrets.ts";
import { pastCap } from "../src/internal/pastCap.ts";
import { redacted } from "../src/internal/redacted.ts";
import { scrubbedDiag } from "../src/internal/scrubbedDiag.ts";

const SEED = 1337;
const LEADS = [
  "loader app.a threw: ",
  "action app.a threw: ",
  "guard app threw: ",
  "runner rejected, rerun in 1000 ms: ",
];
const lead = fc.constantFrom(...LEADS);
const value = fc.stringMatching(/^[a-z0-9-]{6,12}$/);
const text = fc.string({ maxLength: 40 });

/** A secret set past the count cap: `most` 1 and two values. */
const pastSet = (): Set<string> => {
  const into = new Set<string>();
  holdSecrets(into, ["first-past", "second-past"], undefined, undefined, 1);
  return into;
};

describe("scrubbedDiag", () => {
  it("below the caps scrubs the whole message and each frame, the lead included, and writes no lead", () => {
    fc.assert(
      fc.property(lead, value, text, fc.array(text, { maxLength: 3 }), (l, v, rest, frames) => {
        const rq = { secrets: new Set(["", v]), pii: new Set<string>() };
        const message = `${l}${rest} ${v} end`;
        const d = scrubbedDiag({ code: "keel.unexpected", lead: l, message, frames }, rq);
        expect(d).toEqual({
          code: "keel.unexpected",
          message: redacted(message, rq),
          frames: frames.map((f) => redacted(f, rq)),
        });
        expect(d.message).not.toContain(` ${v} end`);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("scrubs a lead that holds a value below the caps", () => {
    const rq = { secrets: new Set(["", "app-secretid"]), pii: new Set<string>() };
    const l = "loader app-secretid threw: ";
    expect(scrubbedDiag({ code: "keel.unexpected", lead: l, message: `${l}boom` }, rq).message).toBe(
      "loader [secret] threw: boom",
    );
  });

  it("past the count cap keeps the lead, marks the rest, and marks each frame", () => {
    fc.assert(
      fc.property(lead, text, fc.array(text, { minLength: 1, maxLength: 3 }), (l, rest, frames) => {
        const rq = { secrets: pastSet(), pii: new Set(["someone"]) };
        const d = scrubbedDiag({ code: "keel.unexpected", lead: l, message: l + rest, frames }, rq);
        expect(d).toEqual({ code: "keel.unexpected", message: `${l}[secret]`, frames: frames.map(() => "[secret]") });
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("past a cap with no secret in the scope marks with `[pii]`", () => {
    const pii = new Set(["ada-lovelace"]);
    pastCap.add(pii);
    const rq = { secrets: new Set<string>(), pii };
    const l = "action app.a threw: ";
    const d = scrubbedDiag({ code: "keel.unexpected", lead: l, message: `${l}refused 7`, frames: ["a.ts:1:1"] }, rq);
    expect(d).toEqual({ code: "keel.unexpected", message: `${l}[pii]`, frames: ["[pii]"] });
  });

  it("past a cap a record with no lead, an empty lead, or a message not starting with its lead is one mark whole", () => {
    fc.assert(
      fc.property(text, lead, (message, l) => {
        const rq = { secrets: pastSet(), pii: new Set<string>() };
        expect(scrubbedDiag({ code: "E1554", message }, rq)).toEqual({ code: "E1554", message: "[secret]" });
        expect(scrubbedDiag({ code: "E1508", lead: "", message }, rq).message).toBe("[secret]");
        const other = `x${l}`;
        expect(scrubbedDiag({ code: "keel.unexpected", lead: l, message: other + message }, rq).message).toBe(
          "[secret]",
        );
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("past a cap a message that is only its lead still ends in a mark", () => {
    const l = "loader app.a threw: ";
    const d = scrubbedDiag({ code: "keel.unexpected", lead: l, message: l }, { secrets: pastSet(), pii: new Set() });
    expect(d.message).toBe(`${l}[secret]`);
  });

  it("with empty sets writes the record as it came, without its lead", () => {
    const rq = { secrets: new Set<string>(), pii: new Set<string>() };
    const l = "loader app.a threw: ";
    expect(scrubbedDiag({ code: "keel.unexpected", lead: l, message: `${l}boom`, frames: ["a.ts:1:1"] }, rq)).toEqual({
      code: "keel.unexpected",
      message: `${l}boom`,
      frames: ["a.ts:1:1"],
    });
  });
});
