import { type Schema, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { expect } from "vitest";

/** The seed every generated run of this app's schema tests starts from, so a failure replays. */
export const SEED = 4242;

const Issues = s.object({ issues: s.array(s.object({ path: s.array(s.json()), rule: s.string() })) });

/** Every value the schema's generator makes parses: the generator and the declaration agree. */
export function acceptsGenerated(schema: Schema<unknown, boolean>, runs = 100): void {
  fc.assert(
    fc.property(gen(schema), (value) => {
      expect(schema.parse(value).ok).toBe(true);
    }),
    { numRuns: runs, seed: SEED },
  );
}

/** A generated value goes through JSON and parses to the value it was: the wire form loses nothing. */
export function survivesJson(schema: Schema<unknown, boolean>, runs = 100): void {
  fc.assert(
    fc.property(gen(schema), (value) => {
      const back = schema.parse(JSON.parse(JSON.stringify(value)));
      expect(back.ok).toBe(true);
      expect(back.ok && back.value).toEqual(value);
    }),
    { numRuns: runs, seed: SEED },
  );
}

/** The dotted paths of the issues `schema` finds in `value`; empty when it parses. */
export function issuePaths(schema: Schema<unknown, boolean>, value: unknown): string[] {
  const r = schema.parse(value);
  if (r.ok) return [];
  const issues = Issues.parse(r.error.data);
  return issues.ok ? issues.value.issues.map((i) => i.path.join(".")) : [r.error.code];
}

/** `value` is refused and one of the reasons names `path`. */
export function rejectsAt(schema: Schema<unknown, boolean>, value: unknown, path: string): void {
  expect(issuePaths(schema, value)).toContain(path);
}
