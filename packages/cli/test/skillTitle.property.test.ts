// A skill's map title is its description up to the last `;`: a prefix of the description holding no codes after it,
// and the whole description when there is no `;`. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { skillTitle } from "../src/docs/skillTitle.ts";

const SEED = 1337;
const part = fc.string({ maxLength: 30 }).map((s) => s.replaceAll(";", ""));

describe("skillTitle", () => {
  it("drops the codes after the last `;`", () => {
    expect(skillTitle("Build pages; E1401, E19xx")).toBe("Build pages");
    expect(skillTitle("Forms; tables; E1401")).toBe("Forms; tables");
    expect(skillTitle("Build pages")).toBe("Build pages");
  });

  it("keeps a description without `;` whole", () => {
    fc.assert(
      fc.property(part, (d) => skillTitle(d) === d),
      { seed: SEED },
    );
  });

  it("is the text before the last `;`, trailing space trimmed", () => {
    fc.assert(
      fc.property(fc.array(part, { minLength: 1, maxLength: 4 }), part, (head, codes) => {
        const before = head.join(";");
        return skillTitle(`${before};${codes}`) === before.trimEnd();
      }),
      { seed: SEED },
    );
  });
});
