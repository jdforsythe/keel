// @vitest-environment happy-dom
// Spec: k.testing Harness: `find(id)`'s `value` is the live DOM `value` of an `input` (not `checkbox`, `radio`,
// `file`), `textarea` or `select`; none on others.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { controlValue } from "../src/internal/controlValue.ts";

const TEXT_TYPES = ["text", "search", "email", "tel", "url", "password", "hidden"] as const;
const NO_VALUE = ["checkbox", "radio", "file"] as const;
const OTHER_TAGS = ["div", "span", "button", "p", "label", "option"] as const;
const line = fc.string({ maxLength: 24 }).filter((v) => !/[\r\n]/.test(v));

describe("controlValue", () => {
  it("property: an input of a text type and a textarea give the value written, untrimmed", () => {
    fc.assert(
      fc.property(fc.constantFrom(...TEXT_TYPES), line, (type, v) => {
        const input = document.createElement("input");
        input.type = type;
        input.value = v;
        const area = document.createElement("textarea");
        area.value = v;
        expect(controlValue(input)).toBe(v);
        expect(controlValue(area)).toBe(v);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });

  it("property: a select gives its first selected option's value", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 8 }), { minLength: 1, maxLength: 5 }),
        fc.nat(),
        (values, n) => {
          const select = document.createElement("select");
          for (const v of values) {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = v;
            select.append(o);
          }
          const pick = values[n % values.length] ?? "";
          select.value = pick;
          expect(controlValue(select)).toBe(pick);
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
  });

  it("property: a checkbox, radio or file input and any other element give no value", () => {
    fc.assert(
      fc.property(fc.constantFrom(...NO_VALUE), fc.constantFrom(...OTHER_TAGS), (type, tag) => {
        const input = document.createElement("input");
        input.type = type;
        expect(controlValue(input)).toBeUndefined();
        expect(controlValue(document.createElement(tag))).toBeUndefined();
      }),
      { seed: 1337, numRuns: 50 },
    );
  });
});
