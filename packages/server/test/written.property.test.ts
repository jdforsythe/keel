// @vitest-environment node
// k.serverlog Parts and Marker: a part is escaped then cut to its bound, keeping the head, with `…+<n>` after a cut;
// the scrub reads no text over 2,000,000 characters when values are held, and a diag keeps its lead then. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { diagLine } from "../src/internal/diagLine.ts";
import { reqLine } from "../src/internal/reqLine.ts";
import { scrubbed } from "../src/internal/scrubbed.ts";
import { scrubbedDiag } from "../src/internal/scrubbedDiag.ts";
import { written } from "../src/internal/written.ts";

const SEED = 1337;
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
/** Whether code unit `c` is one a part never holds raw: a control character, U+2026, U+2028 or U+2029. */
const raw = (c: number): boolean => c < 32 || (c > 126 && c < 160) || c === 0x2026 || c === 0x2028 || c === 0x2029;
const hasRaw = (s: string): boolean => s.split("").some((ch) => raw(ch.charCodeAt(0)));
const CUT = /…\+(\d+)$/;
const text = fc.oneof(
  fc.string({ unit: "binary", maxLength: 80 }),
  fc.string({ unit: fc.constantFrom("a", "…", "+", "1", "\n", "\u0085", LS, PS, "\u0000", "€"), maxLength: 80 }),
);
/** `s` with each raw character as its escape, written independently of `written`. */
const escaped = (s: string): string =>
  s
    .split("")
    .map((ch) => (raw(ch.charCodeAt(0)) ? `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}` : ch))
    .join("");

describe("written", () => {
  it("is at most the bound plus the marker, holds no raw control character or ellipsis of its own, and counts what it left out", () => {
    fc.assert(
      fc.property(text, fc.integer({ min: 0, max: 100 }), (t, max) => {
        const w = written(t, max);
        const m = CUT.exec(w);
        const head = m === null ? w : w.slice(0, m.index);
        expect(hasRaw(head)).toBe(false);
        expect(head.length).toBeLessThanOrEqual(max);
        expect(w.length).toBeLessThanOrEqual(max + 2 + String(t.length).length);
        const k = t.length - Number(m?.[1] ?? 0);
        expect(head).toBe(escaped(t.slice(0, k)));
        if (m !== null) expect(escaped(t.slice(0, k + 1)).length).toBeGreaterThan(max);
        expect(m === null).toBe(k === t.length);
      }),
      { seed: SEED, numRuns: 500 },
    );
  });

  it("writes each raw character as backslash-u and four lowercase hex digits and leaves others alone", () => {
    expect(written(`a\nb\u001bc\u009fd${LS}e${PS}f…g\u007f`, 100)).toBe(
      "a\\u000ab\\u001bc\\u009fd\\u2028e\\u2029f\\u2026g\\u007f",
    );
    expect(written(" ~ €é‧‪", 100)).toBe(" ~ €é‧‪");
  });

  it("never splits an escape and counts characters of the text, not of its written form", () => {
    expect(written("ab\ncd", 7)).toBe("ab…+3");
    expect(written("ab\ncd", 8)).toBe("ab\\u000a…+2");
    expect(written("abc", 3)).toBe("abc");
    expect(written("abcd", 3)).toBe("abc…+1");
  });

  it("cannot be mistaken for a cut when the text holds a marker of its own", () => {
    expect(written("x…+12", 100)).toBe("x\\u2026+12");
    expect(CUT.test(written("x…+12", 100))).toBe(false);
  });

  it("cuts a long text to its head without reading past it", () => {
    expect(written("a".repeat(5_000_000), 2048)).toBe(`${"a".repeat(2048)}…+${5_000_000 - 2048}`);
  });
});

describe("records", () => {
  it("cut a diag message to 2,048, each frame to 256, and a req method to 256 and path to 2,048, in both forms", () => {
    const long = "z".repeat(3000);
    expect(diagLine("compact", { code: "keel.unexpected", message: long })).toBe(
      `keel.unexpected ${"z".repeat(2048)}…+952`,
    );
    const json: unknown = JSON.parse(diagLine("json", { code: "keel.unexpected", message: long, frames: [long] }));
    expect(json).toMatchObject({ message: `${"z".repeat(2048)}…+952`, frames: [`${"z".repeat(256)}…+2744`] });
    expect(reqLine("compact", { method: long, path: `/${long}`, route: undefined, status: 404, ms: 1 })).toBe(
      `${"z".repeat(256)}…+2744 /${"z".repeat(2047)}…+953 404 1ms`,
    );
  });

  it("keep a compact diag on one line and a json diag one valid object", () => {
    fc.assert(
      fc.property(text, (t) => {
        expect(hasRaw(diagLine("compact", { code: "E1", message: t }))).toBe(false);
        const v: unknown = JSON.parse(diagLine("json", { code: "E1", message: t, frames: [t] }));
        expect(v).toMatchObject({ message: written(t, 2048), frames: [written(t, 256)] });
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});

describe("the scrub's read bound", () => {
  const over = "a".repeat(2_000_001);
  it("makes a text over 2,000,000 characters one mark when a value is held, and leaves it untouched with none", () => {
    expect(scrubbed(over, [[new Set(["tok-7f3a9c"]), "[secret]"]])).toBe("[secret]");
    expect(
      scrubbed(over, [
        [new Set(), "[secret]"],
        [new Set(["x@y.z"]), "[pii]"],
      ]),
    ).toBe("[pii]");
    expect(scrubbed(over, [[new Set(), "[secret]"]])).toBe(over);
  });
  it("keeps a diag's lead when its message is over the bound", () => {
    const lead = "runner rejected, rerun in 1000 ms: ";
    const d = scrubbedDiag(
      { code: "keel.unexpected", lead, message: lead + over },
      { secrets: new Set(["tok-7f3a9c"]), pii: new Set() },
    );
    expect(d.message).toBe(`${lead}[secret]`);
  });
});
