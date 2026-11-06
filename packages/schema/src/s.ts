import type { Infer } from "./Infer.ts";
import type { KeelError } from "./KeelError.ts";
import type { Result } from "./Result.ts";
import type { Schema } from "./Schema.ts";
import type { Node } from "./internal/Node.ts";
import { clip } from "./internal/clip.ts";
import { make } from "./internal/make.ts";
import { registry } from "./internal/registry.ts";

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

/** The schema namespace. One builder per primitive; modifiers are `.optional()` and `.nullable()`. */
export const s = {
  string: (opts: { readonly min?: number; readonly max?: number } = {}): Schema<string> =>
    make({ kind: "string", min: opts.min ?? 0, max: opts.max }, false),
  number: (): Schema<number> => make({ kind: "number" }, false),
  int: (): Schema<number> => make({ kind: "int" }, false),
  boolean: (): Schema<boolean> => make({ kind: "boolean" }, false),
  literal: <const L extends string | number | boolean>(value: L): Schema<L> => make({ kind: "literal", value }, false),
  enum: <const E extends readonly [string, ...string[]]>(values: E): Schema<E[number]> =>
    make({ kind: "enum", values }, false),
  id: <B extends string>(brand: B): Schema<string & { readonly __brand: B }> => make({ kind: "id", brand }, false),
  object: <S extends Shape>(shape: S): Schema<ObjectOf<S>> =>
    make({ kind: "object", fields: Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, v.node])) }, false),
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
