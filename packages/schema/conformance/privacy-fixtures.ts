// Shared generators and oracles for k.privacy conformance in @keel/schema. Not a test file. Seed 1337.
// A `Spec` describes a schema tree with `.pii(class)` marks; `build` makes the schema, `expectedPaths` and
// `expectedValues` are the independent oracles for `piiPaths` and `piiValues`.
import { type ObjectSchema, type Schema, s } from "@keel/schema";
import fc from "fast-check";

export const SEED = 1337;
export const RUNS = 100;

export const CLASSES = [
  "name",
  "contact",
  "location",
  "identifier",
  "financial",
  "special",
  "network",
  "content",
] as const;
export type PiiClassName = (typeof CLASSES)[number];
type Mark = PiiClassName | null;

export type Spec =
  | { readonly kind: "string" | "int" | "number" | "boolean"; readonly mark: Mark }
  | { readonly kind: "array"; readonly item: Spec; readonly mark: Mark }
  | { readonly kind: "object"; readonly fields: readonly Spec[]; readonly mark: Mark };
export type ObjectSpec = Extract<Spec, { kind: "object" }>;

const markArb: fc.Arbitrary<Mark> = fc.option(fc.constantFrom(...CLASSES), { freq: 3, nil: null });
const leafArb: fc.Arbitrary<Spec> = fc.record({
  kind: fc.constantFrom("string", "int", "number", "boolean"),
  mark: markArb,
});

const specArb = (depth: number): fc.Arbitrary<Spec> =>
  depth <= 0
    ? leafArb
    : fc.oneof(
        leafArb,
        fc.record({ kind: fc.constant("array" as const), item: specArb(depth - 1), mark: markArb }),
        fc.record({
          kind: fc.constant("object" as const),
          fields: fc.array(specArb(depth - 1), { minLength: 1, maxLength: 3 }),
          mark: markArb,
        }),
      );

const rootArb: fc.Arbitrary<ObjectSpec> = fc.record({
  kind: fc.constant("object" as const),
  fields: fc.array(specArb(2), { minLength: 1, maxLength: 3 }),
  mark: markArb,
});

export const hasMark = (spec: Spec): boolean =>
  spec.mark !== null ||
  (spec.kind === "array" ? hasMark(spec.item) : spec.kind === "object" ? spec.fields.some(hasMark) : false);

/** Drops every mark under a marked node, so each leaf has one class. */
export const exclusive = (spec: Spec, under = false): Spec => {
  const mark = under ? null : spec.mark;
  const inner = under || spec.mark !== null;
  if (spec.kind === "array") return { kind: "array", item: exclusive(spec.item, inner), mark };
  if (spec.kind === "object") return { kind: "object", fields: spec.fields.map((f) => exclusive(f, inner)), mark };
  return { kind: spec.kind, mark };
};

/** The same tree with every mark removed. */
export const stripped = (spec: Spec): Spec => {
  if (spec.kind === "array") return { kind: "array", item: stripped(spec.item), mark: null };
  if (spec.kind === "object") return { kind: "object", fields: spec.fields.map(stripped), mark: null };
  return { kind: spec.kind, mark: null };
};

/** Root objects with at least one marked node anywhere. */
export const markedRoot: fc.Arbitrary<ObjectSpec> = rootArb.filter(hasMark);
/** Marked roots whose marks never nest. */
export const markedRootExclusive: fc.Arbitrary<ObjectSpec> = markedRoot
  .map((spec) => exclusive(spec))
  .filter((spec): spec is ObjectSpec => spec.kind === "object" && hasMark(spec));

const base = (spec: Spec): Schema<unknown> => {
  switch (spec.kind) {
    case "string":
      return s.string();
    case "int":
      return s.int();
    case "number":
      return s.number();
    case "boolean":
      return s.boolean();
    case "array":
      return s.array(build(spec.item));
    case "object":
      return buildObject(spec);
  }
};

/** The schema a spec describes; marked nodes call `.pii(class)`. */
export const build = (spec: Spec): Schema<unknown> => {
  const inner = base(spec);
  return spec.mark === null ? inner : inner.pii(spec.mark);
};

/** The object schema of a root spec (`decodeStrings` lives on object schemas). */
export const buildObject = (spec: ObjectSpec): ObjectSchema<unknown> => {
  const shape: Record<string, Schema<unknown>> = {};
  spec.fields.forEach((f, i) => {
    shape[`f${i}`] = build(f);
  });
  const inner = s.object(shape);
  return spec.mark === null ? inner : inner.pii(spec.mark);
};

/** `path` as dotted text whether an implementation lists it as a string or as segments. */
export const dotted = (path: unknown): string => (Array.isArray(path) ? path.join(".") : String(path));

/** The marked leaves in declaration order; `*` is an array item. */
export const expectedPaths = (
  spec: Spec,
  prefix: readonly string[] = [],
  inherited: Mark = null,
): { path: string; class: PiiClassName }[] => {
  const cls = inherited ?? spec.mark;
  if (spec.kind === "array") return expectedPaths(spec.item, [...prefix, "*"], cls);
  if (spec.kind === "object") return spec.fields.flatMap((f, i) => expectedPaths(f, [...prefix, `f${i}`], cls));
  return cls === null ? [] : [{ path: prefix.join("."), class: cls }];
};

/** Non-empty strings and numbers (as `String()`) of an encoded `value` under marked nodes. */
export const expectedValues = (spec: Spec, value: unknown, inherited = false): string[] => {
  const marked = inherited || spec.mark !== null;
  if (spec.kind === "array")
    return Array.isArray(value) ? value.flatMap((v) => expectedValues(spec.item, v, marked)) : [];
  if (spec.kind === "object") {
    if (typeof value !== "object" || value === null) return [];
    return spec.fields.flatMap((f, i) => expectedValues(f, Reflect.get(value, `f${i}`), marked));
  }
  if (!marked) return [];
  if (typeof value === "string" && value !== "") return [value];
  if (typeof value === "number") return [String(value)];
  return [];
};

export const distinctSorted = (xs: Iterable<string>): string[] => [...new Set(xs)].sort();

/** A root object spec with every mark removed. */
export const strippedRoot = (spec: ObjectSpec): ObjectSpec => ({
  kind: "object",
  fields: spec.fields.map(stripped),
  mark: null,
});
