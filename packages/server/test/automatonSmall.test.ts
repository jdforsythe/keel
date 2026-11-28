// @vitest-environment node
// The scrub's automaton at small scale (k.privacy Copies, Base64, Cost): the counts of a build and a walk on texts of a
// few characters, the failure links, the characters and padding a base64 form takes in, the case folding table, the
// cache of a built automaton, and the byte cap at its boundary. The 400,000-character shapes are in
// scrubSteps.scale.test.ts.
import { describe, expect, it } from "vitest";
import { automatonOf } from "../src/internal/automatonOf.ts";
import { holdValues } from "../src/internal/holdValues.ts";
import { pastCap } from "../src/internal/pastCap.ts";
import { scrubbed } from "../src/internal/scrubbed.ts";
import { tallyOf } from "../src/internal/tallyOf.ts";

const counter = () => ({ build: 0, walk: 0 });
const mask = (text: string, values: readonly string[]): string => scrubbed(text, [[new Set(values), "[S]"]]);

describe("counts of a build and a walk", () => {
  it("counts one value's build: forming, splitting the trie breadth-first, and the links", () => {
    const c = counter();
    // Forms `ab`, `ywi=` and `ywi=` (padded base64 in both alphabets, folded). Forming: each form's units + 1 (13).
    // Splitting, per node its forms and, where it branches, the sort and its forms and children: root 3 + 1 + 5,
    // `a` 1 + 2, `y` 2 + 3, `ab` 1, `yw` 2 + 3, `ywi` 2 + 3, `ywi=` 2 (30). One link step per node under the first
    // level: `ab`, `yw`, `ywi`, `ywi=` (4).
    automatonOf([new Set(["ab"])], c);
    expect(c).toEqual({ build: 47, walk: 0 });
  });

  it("counts a walk one step per unit and one per form ending at it", () => {
    const c = counter();
    expect(scrubbed(" ab", [[new Set(["ab"]), "[S]"]], c)).toBe(" [S]");
    expect(c).toEqual({ build: 47, walk: 4 });
  });

  it("counts forms across sets, the sort of a node's children, and one more link step where a link takes two hops", () => {
    const c = counter();
    // 9 forms: ab, cd, ef and twice each ywi=, y2q=, zwy= (39 forming steps). Splitting: the root's 9 forms, its
    // children a, y, c, e, z sorted by insertion in 6 steps, then 9 + 5 (29); a, c, e 3 each; y 4 + 2 + 6; z 5;
    // ab, cd, ef 1 each; y2, yw, zw 5 each; y2q, ywi, zwy 5 each; y2q=, ywi=, zwy= 2 each (94). Links: 12 nodes under
    // the first level take one step each, and `zwy=` takes two (its parent fails to `y`, which has no `=` child, so
    // the walk goes on to the root) (13).
    automatonOf([new Set(["ab", "cd"]), new Set(["ef"])], c);
    expect(c).toEqual({ build: 146, walk: 0 });
  });

  it("builds nothing for a list holding a set past the cap, wherever it stands, and reads no later set", () => {
    const past = new Set<string>();
    holdValues(past, ["abcdef"], 5);
    expect(pastCap.has(past)).toBe(true);
    for (const sets of [[past], [past, new Set(["x"]), new Set(["y"])], [new Set(["ab"]), new Set(["ab"]), past]]) {
      const c = counter();
      expect(automatonOf(sets, c)).toBe("over");
      expect(c).toEqual(counter());
    }
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

describe("the characters and padding a base64 form takes in", () => {
  // `abcdefgh` is 8 bytes: its base64 is `YWJjZGVmZ2g=`. At alignment 0 its core is `YWJjZGVmZ2`, the characters whose
  // six bits all come from its bytes; the mark takes in the one after (`g`, part its bits) and the `=` after that.
  const B64 = "YWJjZGVmZ2g";
  const CORE = "YWJjZGVmZ2";
  it("takes in the character after the core and every `=` after it", () => {
    expect(mask(`x ${B64}= y`, ["abcdefgh"])).toBe("x [S] y");
    expect(mask(`x ${B64} y`, ["abcdefgh"])).toBe("x [S] y");
    expect(mask(`x ${B64}== y`, ["abcdefgh"])).toBe("x [S] y");
    expect(mask(`x ${CORE} y`, ["abcdefgh"])).toBe("x [S]y");
  });

  it("takes in the character before a core at another alignment", () => {
    // At alignment 1 (one byte before it) the core is `FiY2RlZmdo`; the character before holds two of its bits.
    expect(mask("x QFiY2RlZmdo y", ["abcdefgh"])).toBe("x [S] y");
  });

  it("keeps the widening when a value is itself another value's core, in either order", () => {
    expect(mask(`x ${B64}= y`, ["abcdefgh", CORE])).toBe("x [S] y");
    expect(mask(`x ${B64}= y`, [CORE, "abcdefgh"])).toBe("x [S] y");
    expect(mask(`x ${B64}= y`, [CORE])).toBe("x [S]g= y");
    expect(
      scrubbed(`x ${B64}= y`, [
        [new Set([CORE]), "[A]"],
        [new Set(["abcdefgh"]), "[B]"],
      ]),
    ).toBe("x [A] y");
    expect(
      scrubbed(`x ${B64}= y`, [
        [new Set(["abcdefgh"]), "[B]"],
        [new Set([CORE]), "[A]"],
      ]),
    ).toBe("x [B] y");
  });

  it("gives a form that ends with a core the widening of that core", () => {
    expect(mask(`a x${B64}= b`, ["abcdefgh", `x${CORE}`])).toBe("a [S] b");
    expect(mask(`a x${B64}= b`, [`x${CORE}`])).toBe("a [S]g= b");
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
  it("gives the same automaton again for the same sets, without building", () => {
    const a = new Set(["one"]);
    const c = counter();
    const first = automatonOf([a], c);
    const after = { ...c };
    expect(automatonOf([a], c)).toBe(first);
    expect(c).toEqual(after);
  });

  it("reads the cap before the cache: a set put past it is over at once, and a twin below it still builds", () => {
    const a = new Set<string>();
    holdValues(a, ["one"], 3);
    const built = automatonOf([a]);
    expect(built).not.toBe("over");
    holdValues(a, ["t"], 3);
    expect(pastCap.has(a)).toBe(true);
    expect(automatonOf([a])).toBe("over");
    const b = new Set(["one", "t"]);
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
    expect(
      scrubbed("alpha beta gamma", [
        [a, "[A]"],
        [b, "[B]"],
        [b2, "[C]"],
      ]),
    ).toBe("[A] [B] [C]");
  });

  it("keeps `over` however the sets grow, without building again", () => {
    const a = new Set<string>();
    holdValues(a, ["abcdefgh"], 4);
    const c = counter();
    expect(automatonOf([a], c)).toBe("over");
    a.add("more");
    expect(automatonOf([a], c)).toBe("over");
    expect(c).toEqual(counter());
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

describe("the byte cap", () => {
  it("is past when the bytes pass the cap, not at it", () => {
    // `ab` is 2 bytes.
    for (const [cap, past] of [
      [1, true],
      [2, false],
      [3, false],
    ] as const) {
      const set = new Set<string>();
      holdValues(set, ["ab"], cap);
      expect(pastCap.has(set)).toBe(past);
      expect(automatonOf([set]) === "over").toBe(past);
    }
  });

  it("counts a value in two sets of one scope once, and builds both sets' forms below the cap", () => {
    const secrets = new Set<string>();
    const pii = new Set<string>();
    tallyOf(pii, secrets);
    holdValues(secrets, ["ab"], 2);
    holdValues(pii, ["ab"], 2);
    expect(tallyOf(secrets).bytes).toBe(2);
    expect(pastCap.has(pii)).toBe(false);
    const c = counter();
    expect(automatonOf([secrets, pii], c)).not.toBe("over");
    // The forms of `ab` once per set, on one trie: forming 26; splitting root 6 + 1 + 8, `a` 2 + 3, `y` 4 + 5, `ab` 2,
    // `yw` and `ywi` 4 + 5 each, `ywi=` 4 (53); links 4.
    expect(c.build).toBe(83);
    holdValues(pii, ["c"], 2);
    expect(pastCap.has(secrets)).toBe(true);
    expect(automatonOf([secrets, pii])).toBe("over");
  });
});
