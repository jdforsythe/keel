// @vitest-environment happy-dom
// Spec: k.forms, clause "A field of `s.string({ min: 1 })` shows one message for an absent value, `''` and `'  '`: the `required` one." (rfc:0091)
// Seed 1337. The two idioms: validate on blur (`field.set` then `blur`) and submit through `<Form>` (fixtures `setup`).
// ASSUMPTION: an untouched field of a form with no `initial` holds an absent value.
import { form } from "@keel/forms";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, VALID, setup } from "./fixtures.ts";

const Schema = s.object({ title: s.string({ min: 1 }) });
const blanks = fc
  .array(fc.constantFrom(" ", "\t", "\n", " ", "　"), { minLength: 0, maxLength: 8 })
  .map((a) => a.join(""));

type Seen = { rule: string };

function blurMessage(value: string | undefined, issues: Seen[] = []): string | undefined {
  const out: { v?: string | undefined }[] = [];
  const sc = scope(() => {
    const f = form(Schema, {
      issueText: (issue: Seen) => {
        issues.push({ rule: issue.rule });
        return `T:${issue.rule}`;
      },
    });
    const plain = form(Schema, {});
    for (const g of [f, plain]) {
      const title = g.field("title");
      if (value !== undefined) title.set(value);
      title.blur();
    }
    out.push({ v: plain.errors()["title"] });
  });
  sc.dispose();
  return out[0]?.v;
}

async function submitMessage(value: string | undefined): Promise<string | undefined> {
  const h = setup();
  try {
    h.type("email", VALID.email);
    h.type("age", VALID.age);
    if (value !== undefined) h.type("title", value); // absent: the title is never typed
    await h.submit();
    return h.f.errors()["title"];
  } finally {
    h.dispose();
  }
}

describe("k.forms required message (rfc:0091)", () => {
  test("A field of `s.string({ min: 1 })` shows one message for an absent value, `''` and `'  '`: the `required` one (blur idiom)", () => {
    const absent = blurMessage(undefined);
    expect(absent).toBe("Required");
    expect(blurMessage("")).toBe(absent);
    expect(blurMessage("  ")).toBe(absent);
  });

  test("the blur idiom hands `issueText` rule `required` for an absent value, `''` and any whitespace-only value", () => {
    fc.assert(
      fc.property(fc.option(blanks, { nil: undefined }), (v) => {
        const seen: Seen[] = [];
        blurMessage(v, seen);
        expect(seen).toEqual([{ rule: "required" }]);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("a whitespace-only value shows the same message as an absent one (blur idiom)", () => {
    const absent = blurMessage(undefined);
    fc.assert(
      fc.property(blanks, (v) => {
        expect(blurMessage(v)).toBe(absent);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("the submit idiom shows one message for an absent value, `''` and `'  '`: the `required` one", async () => {
    const absent = await submitMessage(undefined);
    expect(absent).toBe("Required");
    expect(await submitMessage("")).toBe(absent);
    expect(await submitMessage("  ")).toBe(absent);
  });

  test("both idioms show the same message for the same blank value", async () => {
    const viaBlur = blurMessage(undefined);
    expect(await submitMessage(undefined)).toBe(viaBlur);
    expect(await submitMessage("")).toBe(viaBlur);
  });

  test("a non-empty value shorter than `min` keeps the `min` message, not `required`", () => {
    const Two = s.object({ title: s.string({ min: 2 }) });
    const out: (string | undefined)[] = [];
    const sc = scope(() => {
      const f = form(Two, {});
      const title = f.field("title");
      title.set("a");
      title.blur();
      out.push(f.errors()["title"]);
    });
    sc.dispose();
    expect(out[0]).toBe("Must be at least 2 characters");
  });
});
