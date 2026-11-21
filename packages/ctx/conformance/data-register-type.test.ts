// Spec: k.data, clause 2 (k.data#2): "A `register<T>` call whose `sim` returns an object missing a member of `T` does not typecheck."
// Type-level, as owner-type.test.ts does it: `expectTypeOf` assertions, no suppression comments; the package's type check fails
// while a sim side missing a member of `T` is accepted. ASSUMPTION: `register<T>(name, impls)`'s `impls` is `{ real, shell, sim }`,
// each a factory returning `T`.
import { register } from "@keel/ctx";
import { describe, expectTypeOf, test } from "vitest";

interface NoteStore {
  list(): readonly string[];
  add(n: string): void;
}
type Impls = Parameters<typeof register<NoteStore>>[1];
type Full = { list(): readonly string[]; add(n: string): void };
type Missing = { list(): readonly string[] };

describe("k.data: the type of `register<T>` is the contract", () => {
  test("a `register<T>` whose `sim` returns an object missing a member of `T` does not typecheck", () => {
    expectTypeOf<{ real: () => Full; shell: () => Full; sim: () => Missing }>().not.toMatchTypeOf<Impls>();
  });

  test("a `register<T>` whose `real` or `shell` returns an object missing a member of `T` does not typecheck", () => {
    expectTypeOf<{ real: () => Missing; shell: () => Full; sim: () => Full }>().not.toMatchTypeOf<Impls>();
    expectTypeOf<{ real: () => Full; shell: () => Missing; sim: () => Full }>().not.toMatchTypeOf<Impls>();
  });

  test("clean counterpart: all three sides returning every member of `T` typechecks, and the accessor returns `T`", () => {
    expectTypeOf<{ real: () => Full; shell: () => Full; sim: () => Full }>().toMatchTypeOf<Impls>();
    expectTypeOf(register<NoteStore>).returns.returns.toEqualTypeOf<NoteStore>();
  });
});
