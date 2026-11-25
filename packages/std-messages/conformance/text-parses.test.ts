// std.messages, Set "`Set.text(entry)` parses `entry` with the set and returns the parsed entry; it is a locale file's default export, so a file that fails the set throws, imported through `load` or directly, with the error `load` rejects with. `Set.load(locale): Promise<Entry>` imports that locale's file through `load` and parses its default export with the set; a failing entry throws (unexpected)."
// Spec: std.messages, clause "For every value `e`, `Set.text(e)` of the fixture set returns exactly when the set's `parse(e)` is `ok`, a value equal to it; else it throws an error whose message is the one `Set.load` rejects with for a locale file default-exporting `e`. A locale file whose `title` is `'a{b'`, imported directly, throws."
// Seed 1337 (fc.assert below). Fixtures: Demo.schema.ts (the clause's set: `title`, `count`, `kind`), Broken/de-DE.ts (a plain object failing the set, read by `Set.load`) and Direct/de-DE.ts (the same text through `Direct.text`, so importing it throws).
// ASSUMPTIONS: "the message `Set.load` rejects with for a locale file default-exporting `e`" is read from a set built by `messages` over the same locale schema and keys whose importer resolves `{ default: e }`; "a value equal to it" is `toEqual` the `value` of `parse(e)`.
import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import { messages } from "@keel/std-messages";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { AppLocale } from "./fixtures/AppLocale.schema.ts";
import { Demo } from "./fixtures/Demo.schema.ts";

const SEED = 1337;
type Input = Parameters<typeof Demo.text>[0];
const isInput = (e: unknown): e is Input => true;
const asInput = (e: unknown): Input => {
  if (!isInput(e)) throw new Error("unreachable");
  return e;
};
const KEYS = { title: {}, count: { n: s.int({ min: 0 }) }, kind: { k: s.enum(["a", "b"]) } };

/** The error `Set.load` rejects with for a locale file default-exporting `e`. */
async function loadError(e: unknown): Promise<unknown> {
  const set = messages(AppLocale, KEYS, () => Promise.resolve({ default: e }));
  try {
    await set.load("de-DE");
  } catch (error) {
    return error;
  }
  return undefined;
}
const messageOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? Reflect.get(e, "message") : e);
const thrownBy = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
};

const valid = gen(Demo);
const broken = valid.chain((v) =>
  fc.constantFrom(
    { ...v, title: "a{b" },
    { ...v, count: "x" },
    { ...v, extra: 1 },
    { ...v, kind: { select: "k", cases: { a: "A" } } },
    { ...v, kind: { plural: "k", other: "x" } },
    { ...v, count: { plural: "n", "=01": "x", other: "y" } },
    { title: v.title },
    {},
  ),
);

describe("std.messages: Set.text parses its entry with the set", () => {
  test("for every value e, Set.text(e) of the fixture set returns exactly when the set's parse(e) is ok, a value equal to it; else it throws an error whose message is the one Set.load rejects with for a locale file default-exporting e", async () => {
    await fc.assert(
      fc.asyncProperty(fc.oneof(valid, broken, fc.anything(), fc.jsonValue()), async (e) => {
        const parsed = Demo.parse(e);
        if (parsed.ok) {
          expect(Demo.text(asInput(e))).toEqual(parsed.value);
          return;
        }
        const error = thrownBy(() => Demo.text(asInput(e)));
        expect(error).toBeInstanceOf(Error);
        const loaded = await loadError(e);
        expect(loaded).toBeInstanceOf(Error);
        expect(messageOf(error)).toBe(messageOf(loaded));
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  test("every gen entry of the fixture set is returned by Set.text equal to its parse", () => {
    fc.assert(
      fc.property(valid, (e) => {
        const parsed = Demo.parse(e);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) expect(Demo.text(asInput(e))).toEqual(parsed.value);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  test("a locale file whose title is 'a{b', imported directly, throws", async () => {
    await expect(import("./fixtures/Direct/de-DE.ts")).rejects.toThrow();
  });

  test("the error a directly imported locale file throws is the one Set.load rejects with for a file of the same text (Broken/de-DE.ts)", async () => {
    const direct = await import("./fixtures/Direct/de-DE.ts").then(
      () => undefined,
      (error: unknown) => error,
    );
    const viaBroken = await import("./fixtures/Broken.schema.ts")
      .then((m) => m.Broken.load("de-DE"))
      .catch((e: unknown) => e);
    expect(messageOf(direct)).toBe(messageOf(viaBroken));
  });
});
