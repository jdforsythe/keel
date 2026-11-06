// Flag parsing round-trip: any schema-valid input, written as argv, parses back to itself. Seed 1337.
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fieldsOf } from "../src/internal/fieldsOf.ts";
import { parseArgv } from "../src/internal/parseArgv.ts";
import { operations } from "../src/operations.ts";
import type { Input } from "../src/types/Input.ts";
import type { Operation } from "../src/types/Operation.ts";

const SEED = 1337;

const toArgv = (op: Operation, input: Input): string[] => {
  const fields = fieldsOf(op);
  const words: string[] = [];
  const flags: string[] = [];
  for (const name of op.positional) {
    const v: unknown = Reflect.get(input, name);
    if (Array.isArray(v)) words.push(...v.map(String));
    else if (v !== undefined) words.push(String(v));
  }
  for (const [name, node] of fields) {
    if (op.positional.includes(name)) continue;
    const v: unknown = Reflect.get(input, name);
    if (v === undefined) continue;
    if (node.kind === "boolean") flags.push(v === true ? `--${name}` : `--${name}=false`);
    else flags.push(`--${name}=${String(v)}`);
  }
  return [op.name, ...words, ...flags];
};

/** argv cannot spell an empty array: absent and [] are the same input. */
const norm = (input: Input): Record<string, unknown> =>
  Object.fromEntries(Object.entries(input).filter(([, v]) => !(Array.isArray(v) && v.length === 0)));

/** Inputs argv can spell: no empty strings, no positional word starting with "-", no rest array without its head. */
const representable = (op: Operation, input: Input): boolean => {
  if (input.limit !== undefined && input.limit < 1) return false;
  const [head, ...rest] = op.positional;
  if (
    head !== undefined &&
    rest.length > 0 &&
    Reflect.get(input, head) === undefined &&
    rest.some((r) => Reflect.get(input, r) !== undefined)
  )
    return false;
  for (const [name] of fieldsOf(op)) {
    const v: unknown = Reflect.get(input, name);
    const items: unknown[] = Array.isArray(v) ? v : [v];
    for (const x of items)
      if (typeof x === "string" && (x === "" || (op.positional.includes(name) && x.startsWith("-")))) return false;
  }
  return true;
};

describe("argv round-trip", () => {
  for (const op of operations) {
    it(`${op.name}: parseArgv(toArgv(input)) equals input`, () => {
      fc.assert(
        fc.property(gen(op.input), (input) => {
          fc.pre(representable(op, input));
          const parsed = parseArgv(toArgv(op, input), operations);
          expect(parsed.ok).toBe(true);
          if (parsed.ok) expect(norm(parsed.input)).toEqual(norm(input));
        }),
        { seed: SEED, numRuns: 100 },
      );
    });
  }

  it("a flag outside the operation's input schema is E1052, never accepted", () => {
    fc.assert(
      fc.property(fc.constantFrom(...operations), fc.stringMatching(/^[a-z]{2,10}$/), (op, name) => {
        fc.pre(!fieldsOf(op).has(name));
        const parsed = parseArgv([op.name, `--${name}`], operations);
        expect(parsed.ok).toBe(false);
        if (!parsed.ok) expect(parsed.diags.map((d) => d.code)).toEqual(["E1052"]);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
