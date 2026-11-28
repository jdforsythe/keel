// Spec: k.fixes, clause "The chain `json` ends in a function that returns the parsed value for a valid text and the fallback for `{`, and throws for neither."
// Spec: k.fixes, clause "The chains `sdk`, `json`, `timeout` and `conflict` each end in a project whose probe holds: the expected failure is `err` with the code the end names, and a `TypeError` thrown inside the wrapped call is thrown on as itself."
// Seed 1337. For `json` the expected failure is `schema.invalid`, taken to the fallback; no call is wrapped, so there is no TypeError to pass on.
import fc from "fast-check";
import { expect, test } from "vitest";
import { load } from "./end/load.ts";

const fallback = { theme: "light" };

test("a valid text returns the parsed value", () => {
  expect(load('{"theme":"dark"}', fallback)).toEqual({ theme: "dark" });
});

test("`{` returns the fallback and throws for neither", () => {
  expect(load("{", fallback)).toBe(fallback);
});

test("property: any text returns the parsed value when it parses as Prefs, else the fallback, and never throws", () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.string(),
        fc.json(),
        fc.string().map((t) => JSON.stringify({ theme: t })),
      ),
      (text) => {
        const got = load(text, fallback);
        let want = fallback;
        try {
          const v: unknown = JSON.parse(text);
          if (typeof v === "object" && v !== null && typeof Reflect.get(v, "theme") === "string") {
            want = { theme: String(Reflect.get(v, "theme")) };
          }
        } catch {
          // not JSON: the fallback
        }
        expect(got).toEqual(want);
      },
    ),
    { seed: 1337, numRuns: 100 },
  );
});
