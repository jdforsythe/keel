// Spec: k.forms, clause "Two `form()` calls in separate render roots with one schema and one `id` give equal field ids; a second live one in the same root gets `~2`."
// Seed 1337 (fc.assert seed below).
import { form } from "@keel/forms";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";

const S = s.object({ note: s.string() });

function ids(id: string | undefined, count: number): string[] {
  const out: string[] = [];
  const root = scope(() => {
    for (let i = 0; i < count; i++) out.push(form(S, id === undefined ? {} : { id }).field("note").id);
  });
  root.dispose();
  return out;
}

test("Two `form()` calls in separate render roots with one schema and one `id` give equal field ids", () => {
  expect(ids("order", 1)).toEqual(["order:note"]);
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z][a-z0-9-]{0,10}$/), (id) => {
      expect(ids(id, 1)).toEqual(ids(id, 1));
      expect(ids(id, 1)).toEqual([`${id}:note`]);
    }),
    { seed: 1337, numRuns: 30 },
  );
});

test("Two roots with one schema and no `id` give equal field ids (stable hash, not a counter)", () => {
  const a = ids(undefined, 1);
  const b = ids(undefined, 1);
  expect(a).toEqual(b);
  expect(a[0]).toMatch(/:note$/);
});

test("A second live form with one `id` in the same root gets `~2`", () => {
  const [first, second, third] = ids("order", 3);
  expect(first).toBe("order:note");
  expect(second).toContain("order~2:");
  expect(third).toContain("order~3:");
});
