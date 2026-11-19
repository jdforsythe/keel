// @vitest-environment node
// The scrub's automaton at small scale (k.privacy Server log): the counts of a build and a walk on texts of a few
// characters, the failure links, the padding a form takes in, the case folding table, and the cache of a built
// automaton. The 400,000-character shapes are in scrubSteps.scale.test.ts.
import { describe, expect, it } from "vitest";
import { automatonOf } from "../src/internal/automatonOf.ts";
import { pastCap } from "../src/internal/pastCap.ts";
import { scrubbed } from "../src/internal/scrubbed.ts";

const counter = () => ({ build: 0, walk: 0, forms: 0 });
const mask = (text: string, values: readonly string[]): string => scrubbed(text, [[new Set(values), "[S]"]]);

describe("counts of a build and a walk", () => {
  it("counts one value's build: the value, the trie's units and the links, and the forms' characters", () => {
    const c = counter();
    // Forms `ab` and `ywi=` (base64, folded): 1 value formed, trie steps (0+1)+2 + (0+1)+4, one link step per
    // node under the first level (b, w, i, =).
    automatonOf([new Set(["ab"])], c);
    expect(c).toEqual({ build: 13, walk: 0, forms: 6 });
  });

  it("counts a walk one step per unit and one per form ending at it", () => {
    const c = counter();
    expect(scrubbed(" ab", [[new Set(["ab"]), "[S]"]], c)).toBe(" [S]");
    expect(c).toEqual({ build: 13, walk: 4, forms: 6 });
  });

  it("counts values formed across sets, trie steps and link steps, one more where a link takes two hops", () => {
    const c = counter();
    // 3 values formed; forms ab, cd, ef, y2q=, ywi=, zwy= (18 characters); trie steps are each form's length plus one
    // (24); 12 nodes below the first level take one link step each, and `zwy=` takes two (its parent fails to `y`,
    // which has no `=` child, so the walk goes on to the root): 3 + 24 + 13.
    automatonOf([new Set(["ab", "cd"]), new Set(["ef"])], c);
    expect(c).toEqual({ build: 40, walk: 0, forms: 18 });
  });

  it("stops forming at the cap: the values formed so far are counted, and the later sets are not formed", () => {
    const over = counter();
    expect(automatonOf([new Set(["abcdef"]), new Set(["x"]), new Set(["y"])], over, 5)).toBe("over");
    expect(over.build).toBe(1);
    expect(over.forms).toBeGreaterThan(5);
    const same = counter();
    expect(automatonOf([new Set(["ab"]), new Set(["ab"]), new Set(["cd"])], same, 6)).toBe("over");
    expect(same).toEqual({ build: 3, walk: 0, forms: 12 });
  });
});

describe("failure links", () => {
  it("follows two links to find a form that ends inside a longer one's prefix", () => {
    // The node `zbabc` fails to `abc` through `bab` then `ab`: the text ends inside the unfinished `zbabcq`.
    const values = ["abc", "babz", "zbabcq"];
    expect(mask("zbabcw", values)).toBe("zb[S]w");
    expect(mask("zbabc", values)).toBe("zb[S]");
  });

  it("finds a form after a partial match breaks off", () => {
    expect(mask("aaab aaaa", ["aaab"])).toBe("[S] aaaa");
    expect(mask("xx abab abac ", ["abac"])).toBe("xx abab [S] ");
    expect(mask("abcabcd", ["abcd"])).toBe("abc[S]");
    expect(mask("abababc", ["ababc"])).toBe("ab[S]");
  });

  it("counts a walk across failure links: one step per unit, one per link followed, one per form ending", () => {
    const c = counter();
    scrubbed("zbabcw", [[new Set(["abc", "babz", "zbabcq"]), "[S]"]], c);
    // z, b, a, b, c advance one step each, `abc` ends at c (1), and `w` finds no child at `zbabc`, at `abc` or at the root (3).
    expect(c.walk).toBe(9);
  });
});

describe("padding", () => {
  // `abcdefgh` is 8 bytes: its unpadded base64 `YWJjZGVmZ2g` takes in the one `=` that follows it.
  const B64 = "YWJjZGVmZ2g";
  it("takes in the padding after an unpadded base64 form", () => {
    expect(mask(`x ${B64}= y`, ["abcdefgh"])).toBe("x [S] y");
    expect(mask(`x ${B64} y`, ["abcdefgh"])).toBe("x [S] y");
    expect(mask(`x ${B64}== y`, ["abcdefgh"])).toBe("x [S]= y");
  });

  it("keeps the larger padding when two values give the same form, in either order", () => {
    expect(mask(`x ${B64}= y`, ["abcdefgh", B64])).toBe("x [S] y");
    expect(mask(`x ${B64}= y`, [B64, "abcdefgh"])).toBe("x [S] y");
    expect(
      scrubbed(`x ${B64}= y`, [
        [new Set([B64]), "[A]"],
        [new Set(["abcdefgh"]), "[B]"],
      ]),
    ).toBe("x [A] y");
    expect(
      scrubbed(`x ${B64}= y`, [
        [new Set(["abcdefgh"]), "[B]"],
        [new Set([B64]), "[A]"],
      ]),
    ).toBe("x [B] y");
  });

  it("gives a form that ends with another the padding of the one it ends with", () => {
    expect(mask(`a x${B64}= b`, ["abcdefgh", `x${B64}`])).toBe("a [S] b");
    expect(mask(`a x${B64}= b`, [`x${B64}`])).toBe("a [S]= b");
  });
});

describe("the empty value", () => {
  it("forms nothing from an empty string", () => {
    expect(mask("abc", [""])).toBe("abc");
    expect(mask("", [""])).toBe("");
    expect(mask("abc", ["", "abc"])).toBe("[S]");
  });
});

// Units named by code point, so a case reads as what it is.
const u = (code: number): string => String.fromCharCode(code);
const KELVIN = u(0x212a);
const ANGSTROM = u(0x212b);
const A_RING = u(0xe5);
const DOTLESS_I = u(0x131);
const DOTTED_I = u(0x130);
const LONG_S = u(0x17f);
const MICRO = u(0xb5);
const CAPITAL_MU = u(0x39c);
const SHARP_S = u(0xdf);
const IOTA_LOWER = u(0x1f80);
const IOTA_TITLE = u(0x1f88);

describe("case folding", () => {
  it("folds the Kelvin sign and the Angstrom sign with their letters", () => {
    expect(mask(`a ${KELVIN}elvin b`, ["kelvin"])).toBe("a [S] b");
    expect(mask("a KELVIN b", [`${KELVIN}elvin`])).toBe("a [S] b");
    expect(mask(`a ${ANGSTROM}ngstrom b`, [`${A_RING}ngstrom`])).toBe("a [S] b");
  });

  it("folds the dotless i, the long s and the micro sign through their upper case", () => {
    expect(mask("a INFO b", [`${DOTLESS_I}nfo`])).toBe("a [S] b");
    expect(mask("a SECRET b", [`${LONG_S}ecret`])).toBe("a [S] b");
    expect(mask(`a ${CAPITAL_MU}mx b`, [`${MICRO}mx`])).toBe("a [S] b");
  });

  it("folds a titlecase letter with an iota subscript to its lower case form", () => {
    expect(mask(`a ${IOTA_TITLE}bc b`, [`${IOTA_LOWER}bc`])).toBe("a [S] b");
    expect(mask(`a ${IOTA_LOWER}bc b`, [`${IOTA_TITLE}bc`])).toBe("a [S] b");
  });

  it("does not fold a unit whose case mapping is longer than one unit", () => {
    expect(mask("a sab b", [`${SHARP_S}ab`])).toBe("a sab b");
    expect(mask("a SSab b", [`${SHARP_S}ab`])).toBe("a SSab b");
    expect(mask(`a ${SHARP_S}ab b`, [`${SHARP_S}ab`])).toBe("a [S] b");
    expect(mask("a iab b", [`${DOTTED_I}ab`])).toBe("a iab b");
    expect(mask(`a ${DOTTED_I}ab b`, [`${DOTTED_I}ab`])).toBe("a [S] b");
    expect(mask("a iab b", ["iab"])).toBe("a [S] b");
  });

  it("folds ordinary letters in text and values alike", () => {
    expect(mask("a SeCrEt b", ["sEcReT"])).toBe("a [S] b");
  });
});

describe("the cache of a built automaton", () => {
  it("gives the same automaton again for the same sets and cap, without building", () => {
    const a = new Set(["one"]);
    const c = counter();
    const first = automatonOf([a], c);
    const after = { ...c };
    expect(automatonOf([a], c)).toBe(first);
    expect(c).toEqual(after);
  });

  it("builds again for another cap, in either direction", () => {
    const a = new Set(["one"]);
    const big = automatonOf([a]);
    expect(big).not.toBe("over");
    expect(automatonOf([a], undefined, 3)).toBe("over");
    expect(automatonOf([a])).not.toBe("over");
    const b = new Set(["two"]);
    expect(automatonOf([b], undefined, 3)).toBe("over");
    expect(automatonOf([b])).not.toBe("over");
  });

  it("builds again when a set has grown, and the new value is found", () => {
    const a = new Set(["alpha"]);
    expect(scrubbed("x alpha beta y", [[a, "[S]"]])).toBe("x [S] beta y");
    a.add("beta");
    expect(scrubbed("x alpha beta y", [[a, "[S]"]])).toBe("x [S] [S] y");
  });

  it("builds again for another list of sets with the same first set, however alike", () => {
    const a = new Set(["alpha"]);
    const b = new Set(["beta"]);
    const b2 = new Set(["gamma"]);
    const passes = (second: ReadonlySet<string>) => [[a, "[A]"] as const, [second, "[B]"] as const];
    expect(scrubbed("alpha beta gamma", passes(b))).toBe("[A] [B] gamma");
    expect(scrubbed("alpha beta gamma", passes(b2))).toBe("[A] beta [B]");
    expect(scrubbed("alpha beta gamma", [[a, "[A]"]])).toBe("[A] beta gamma");
    expect(scrubbed("alpha beta gamma", [[a, "[A]"], [b, "[B]"], [b2, "[C]"]])).toBe("[A] [B] [C]");
  });

  it("keeps `over` however the sets grow, without building again", () => {
    const a = new Set(["abcdefgh"]);
    const c = counter();
    expect(automatonOf([a], c, 4)).toBe("over");
    const after = { ...c };
    a.add("more");
    expect(automatonOf([a], c, 4)).toBe("over");
    expect(c).toEqual(after);
  });

  it("is `over` for a list holding a set past its cap, before anything is read", () => {
    const a = new Set(["x"]);
    const warm = automatonOf([a]);
    expect(warm).not.toBe("over");
    pastCap.add(a);
    expect(automatonOf([a])).toBe("over");
    expect(automatonOf([new Set(["y"]), a])).toBe("over");
    expect(scrubbed("a x b", [[a, "[S]"]])).toBe("[S]");
  });

  it("builds an automaton for no sets, which matches nothing", () => {
    expect(automatonOf([])).not.toBe("over");
    expect(automatonOf([])).not.toBe("over");
  });
});

describe("the cap", () => {
  it("is over when the forms pass the cap, not at it", () => {
    // `ab` forms `ab` and `ywi=`: 6 characters.
    expect(automatonOf([new Set(["ab"])], undefined, 5)).toBe("over");
    expect(automatonOf([new Set(["ab"])], undefined, 6)).not.toBe("over");
    expect(automatonOf([new Set(["ab"])], undefined, 7)).not.toBe("over");
  });

  it("counts a form shared by two sets once, and forms every value until the cap is passed", () => {
    const c = counter();
    expect(automatonOf([new Set(["ab"]), new Set(["ab"])], c, 6)).not.toBe("over");
    expect(c.build).toBeGreaterThanOrEqual(2);
    expect(c.forms).toBe(6);
  });
});
