import type { Id } from "./Id.ts";
import type { Infer } from "./Infer.ts";
import type { JsonValue } from "./JsonValue.ts";
import type { KeelError } from "./KeelError.ts";
import type { ObjectSchema } from "./ObjectSchema.ts";
import type { Result } from "./Result.ts";
import type { Schema } from "./Schema.ts";
import type { Secret } from "./Secret.ts";
import type { StringInput } from "./StringInput.ts";
import type { Node } from "./internal/Node.ts";
import { clip } from "./internal/clip.ts";
import { fromStrings } from "./internal/fromStrings.ts";
import { invalid } from "./internal/invalid.ts";
import { make } from "./internal/make.ts";
import { protoPaths } from "./internal/protoPaths.ts";
import { registry } from "./internal/registry.ts";
import { stringEntries } from "./internal/stringEntries.ts";

type Shape = Readonly<Record<string, Schema<unknown, boolean>>>;
type OptionalKeys<S> = { [K in keyof S]: S[K] extends Schema<unknown, true> ? K : never }[keyof S];
type Flat<T> = { [K in keyof T]: T[K] };
type ObjectOf<S extends Shape> = Flat<
  { [K in Exclude<keyof S, OptionalKeys<S>>]: Infer<S[K]> } & { [K in OptionalKeys<S>]?: Infer<S[K]> }
>;
type ErrorSchema<C extends string, D> = Schema<KeelError<C, D>> & {
  make(data: D, message?: string): KeelError<C, D>;
};
type Variant<K extends string> = Schema<{ readonly [P in K]: string | number | boolean }>;

type NumberBounds = { readonly min?: number; readonly max?: number };

/** Validate inclusive bounds at construction; keys are omitted when unset so nodes stay plain JSON. */
function bounds(kind: "number" | "int", opts: NumberBounds): NumberBounds {
  const { min, max } = opts;
  for (const b of [min, max])
    if (b !== undefined && !Number.isFinite(b)) throw new Error(`${kind} bound ${b} is not finite`);
  if (min !== undefined && max !== undefined && min > max) throw new Error(`${kind} min ${min} exceeds max ${max}`);
  if (kind === "int" && Math.ceil(min ?? Number.NEGATIVE_INFINITY) > Math.floor(max ?? Number.POSITIVE_INFINITY))
    throw new Error(`int range ${min}..${max} contains no integer`);
  return { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) };
}

/** The schema namespace. One builder per primitive; modifiers are `.optional()` and `.nullable()`. */
export const s = {
  string: (opts: { readonly min?: number; readonly max?: number } = {}): Schema<string> => {
    const min = opts.min ?? 0;
    if (opts.max !== undefined && min > opts.max) throw new Error(`string min ${min} exceeds max ${opts.max}`);
    return make({ kind: "string", min, max: opts.max }, false);
  },
  number: (opts: NumberBounds = {}): Schema<number> => make({ kind: "number", ...bounds("number", opts) }, false),
  int: (opts: NumberBounds = {}): Schema<number> => make({ kind: "int", ...bounds("int", opts) }, false),
  boolean: (): Schema<boolean> => make({ kind: "boolean" }, false),
  literal: <const L extends string | number | boolean>(value: L): Schema<L> => make({ kind: "literal", value }, false),
  enum: <const E extends readonly [string, ...string[]]>(values: E): Schema<E[number]> =>
    make({ kind: "enum", values }, false),
  json: (): Schema<JsonValue> => make({ kind: "json" }, false),
  secret: <S extends Schema<unknown>>(inner: S): Schema<Secret<Infer<S>>> =>
    make({ kind: "secret", inner: inner.node }, false),
  id: <B extends string>(brand: B): Schema<Id<B>> => make({ kind: "id", brand }, false),
  object: <S extends Shape>(shape: S): ObjectSchema<ObjectOf<S>> => {
    const node: Node = {
      kind: "object",
      fields: Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, v.node])),
    };
    const base = make<ObjectOf<S>, false>(node, false);
    return {
      ...base,
      decodeStrings: (input: StringInput) => {
        const entries = stringEntries(input);
        const bad = protoPaths(entries.keys());
        return bad.length > 0 ? { ok: false, error: invalid(bad) } : base.parse(fromStrings(node, "", entries));
      },
    };
  },
  array: <S extends Schema<unknown>>(item: S): Schema<Infer<S>[]> => make({ kind: "array", item: item.node }, false),
  record: <S extends Schema<unknown>>(value: S): Schema<Record<string, Infer<S>>> =>
    make({ kind: "record", value: value.node }, false),
  union: <K extends string, V extends readonly [Variant<K>, ...Variant<K>[]]>(
    key: K,
    variants: V,
  ): Schema<Infer<V[number]>> => {
    const nodes: Node[] = variants.map((v) => v.node);
    const tags = nodes.map((n) =>
      n.kind === "object" && n.fields[key]?.kind === "literal" ? n.fields[key] : undefined,
    );
    const bad = tags.findIndex((t, i) => t === undefined || tags.findIndex((u) => u?.value === t.value) !== i);
    if (bad >= 0) throw new Error(`union variant ${bad} needs a unique literal ${clip(key)}`);
    return make({ kind: "union", key, variants: nodes }, false);
  },
  error: <C extends string, D extends Schema<unknown>>(code: C, data: D): ErrorSchema<C, Infer<D>> => {
    const node: Node = {
      kind: "object",
      fields: {
        code: { kind: "literal", value: code },
        message: { kind: "string", min: 0, max: undefined },
        data: data.node,
      },
    };
    const make_ = (value: Infer<D>, message: string = code): KeelError<C, Infer<D>> => ({ code, message, data: value });
    return { ...make<KeelError<C, Infer<D>>, false>(node, false), make: make_ };
  },
  result: <T extends Schema<unknown>, E extends Schema<unknown>>(
    value: T,
    error: E,
  ): Schema<Result<Infer<T>, Infer<E>>> =>
    make(
      {
        kind: "union",
        key: "ok",
        variants: [
          { kind: "object", fields: { ok: { kind: "literal", value: true }, value: value.node } },
          { kind: "object", fields: { ok: { kind: "literal", value: false }, error: error.node } },
        ],
      },
      false,
    ),
  register: (name: string, schema: Schema<unknown, boolean>): void => {
    const prior = registry.get(name);
    if (prior !== undefined && prior !== schema) throw new Error(`${clip(name)} is registered to a different schema`);
    registry.set(name, schema);
  },
  registry: (): ReadonlyMap<string, Schema<unknown, boolean>> => new Map(registry),
};

/** Type-level members of the namespace: `s.infer<typeof X>`. */
export declare namespace s {
  type infer<S> = Infer<S>;
}
