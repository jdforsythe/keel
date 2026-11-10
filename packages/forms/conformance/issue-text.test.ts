// @vitest-environment happy-dom
// Spec: k.forms, clause "With `issueText`, an invalid field's error text is exactly its return value for that field's issue, whose `rule`, `path` and constraint match the schema; without it, a `format` issue shows `Invalid value`." (rfc:0079)
// Seed 1337. ASSUMPTION: a field is validated on blur, with no router or DOM binding needed (k.forms Validation).
import { form } from "@keel/forms";
import { scope } from "@keel/reactive";
import { pathToString, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;

const mkEven = () =>
  s.format("even", s.int(), {
    check: (v) => v % 2 === 0,
    gen: { from: s.int({ min: -50, max: 50 }), map: (n) => n * 2 },
  });
const mkSchema = () =>
  s.object({
    title: s.string({ min: 2, max: 5 }),
    age: s.int({ min: 0, max: 120 }),
    kind: s.enum(["a", "b"]),
    pair: mkEven(),
  });

type Seen = { rule: string; path: string; min?: number; max?: number; values?: readonly unknown[]; format?: string };

function run<T>(fn: (seen: Seen[], Schema: ReturnType<typeof mkSchema>) => T): T {
  const slot: { readonly v: T }[] = [];
  const sc = scope(() => {
    slot.push({ v: fn([], mkSchema()) });
  });
  sc.dispose();
  const box = slot[0];
  if (box === undefined) throw new Error("fixture: scope produced nothing");
  return box.v;
}

const asPath = (p: unknown): string => (Array.isArray(p) ? pathToString(p) : String(p));

describe("k.forms issueText", () => {
  test("With `issueText`, an invalid field's error text is exactly its return value for that field's issue", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{0,1}$/), fc.integer({ min: 121, max: 1000 }), (shortTitle, oldAge) => {
        run((seen, Schema) => {
          const f = form(Schema, {
            issueText: (issue: Seen) => {
              seen.push({ ...issue, path: asPath(issue.path) });
              return `T:${issue.rule}:${asPath(issue.path)}`;
            },
          });
          const title = f.field("title");
          title.set(shortTitle);
          title.blur();
          const age = f.field("age");
          age.set(oldAge);
          age.blur();
          expect(f.errors()["title"]).toBe("T:min:title");
          expect(f.errors()["age"]).toBe("T:max:age");
        });
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("the issue's `rule`, `path` and constraint match the schema node at the path", () => {
    run((seen, Schema) => {
      const f = form(Schema, {
        issueText: (issue: Seen) => {
          seen.push({ ...issue, path: asPath(issue.path) });
          return "x";
        },
      });
      const title = f.field("title");
      title.set("a");
      title.blur();
      const age = f.field("age");
      age.set(500);
      age.blur();
      const pair = f.field("pair");
      pair.set(3);
      pair.blur();
      const by = (p: string): Seen | undefined => seen.find((i) => i.path === p);
      expect(by("title")).toMatchObject({ rule: "min", min: 2 });
      expect(by("age")).toMatchObject({ rule: "max", max: 120 });
      expect(by("pair")).toMatchObject({ rule: "format", format: "even" });
    });
  });

  test("without `issueText`, a `format` issue shows `Invalid value`", () => {
    fc.assert(
      fc.property(fc.integer({ min: -500, max: 500 }), (n) => {
        run((_, Schema) => {
          const f = form(Schema, {});
          const pair = f.field("pair");
          pair.set(n * 2 + 1);
          pair.blur();
          expect(f.errors()["pair"]).toBe("Invalid value");
        });
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("`issueText` is not called for a valid field", () => {
    run((seen, Schema) => {
      const f = form(Schema, { issueText: (issue: Seen) => (seen.push(issue), "x") });
      const pair = f.field("pair");
      pair.set(4);
      pair.blur();
      expect(f.errors()["pair"]).toBeUndefined();
      expect(seen).toEqual([]);
    });
  });
});
