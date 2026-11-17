// Properties of the E1113 walk (k.privacy): `action()` and `loader()` throw at declaration exactly when their `output`
// holds an `s.secret` node, naming its dotted path (`*` for an array item or record value).
// Seed 1337.
import { type Schema, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { action } from "../src/action.ts";
import { loader } from "../src/loader.ts";

const SEED = 1337;

type Tree =
  | { readonly k: "leaf" }
  | { readonly k: "obj"; readonly fields: readonly (readonly [string, Tree, boolean])[] }
  | { readonly k: "arr" | "rec" | "nul"; readonly inner: Tree };

const LEAF: Tree = { k: "leaf" };
const tree: fc.Memo<Tree> = fc.memo((n) =>
  n <= 1
    ? fc.constant(LEAF)
    : fc.oneof(
        fc.constant(LEAF),
        fc
          .uniqueArray(fc.tuple(fc.stringMatching(/^[a-z]{1,4}$/), tree(n - 1), fc.boolean()), {
            maxLength: 3,
            selector: ([key]) => key,
          })
          .map((fields): Tree => ({ k: "obj", fields })),
        fc
          .tuple(fc.constantFrom<"arr" | "rec" | "nul">("arr", "rec", "nul"), tree(n - 1))
          .map(([k, inner]): Tree => ({ k, inner })),
      ),
);

/** Every leaf's dotted path, in declaration order. */
function leaves(t: Tree, path: readonly string[]): (readonly string[])[] {
  if (t.k === "leaf") return [path];
  if (t.k === "obj") return t.fields.flatMap(([key, f]) => leaves(f, [...path, key]));
  return leaves(t.inner, t.k === "nul" ? path : [...path, "*"]);
}

/** The schema of `t`, its leaf number `target` (in `leaves` order) an `s.secret(s.string())`, the others `s.string()`. */
function build(t: Tree, target: number, count: { n: number }): Schema<unknown> {
  if (t.k === "leaf") return count.n++ === target ? s.secret(s.string()) : s.string();
  if (t.k !== "obj") {
    const inner = build(t.inner, target, count);
    return t.k === "arr" ? s.array(inner) : t.k === "rec" ? s.record(inner) : inner.nullable();
  }
  const shape: Record<string, Schema<unknown, boolean>> = {};
  for (const [key, f, optional] of t.fields) {
    const field = build(f, target, count);
    shape[key] = optional ? field.optional() : field;
  }
  return s.object(shape);
}

function thrown(f: () => unknown): readonly [unknown, string] | null {
  try {
    f();
  } catch (e) {
    return e instanceof Error ? [Reflect.get(e, "code"), e.message] : [e, ""];
  }
  return null;
}

const declare = {
  action: (output: Schema<unknown>) => action({ input: s.object({}), output }, async () => ok({})),
  loader: (output: Schema<unknown>) => loader({ output }, async () => ok({})),
};

describe("E1113: an s.secret node in a loader or action output", () => {
  it.each(Object.entries(declare))("%s throws exactly when one is present and names its path", (_name, make) => {
    fc.assert(
      fc.property(tree(5), fc.option(fc.nat()), (t, pick) => {
        const all = leaves(t, []);
        const target = pick === null || all.length === 0 ? -1 : pick % all.length;
        const got = thrown(() => make(build(t, target, { n: 0 })));
        const at = all[target];
        if (at === undefined) expect(got).toBeNull();
        else
          expect(got).toEqual([
            "E1113",
            `E1113 output holds s.secret at ${at.length === 0 ? "(root)" : at.join(".")}: it would encode as "[secret]"`,
          ]);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("reads through union variants, member lists and formats; an optional s.string() is no secret", () => {
    const v = (tag: string, t: Schema<unknown>) => s.object({ kind: s.literal(tag), t });
    const tagged = s.union("kind", [v("a", s.string()), v("b", s.secret(s.string()))]);
    expect(thrown(() => declare.action(s.object({ u: tagged })))?.[1]).toBe(
      'E1113 output holds s.secret at u.t: it would encode as "[secret]"',
    );
    expect(thrown(() => declare.loader(s.union([s.string(), s.secret(s.string())])))?.[1]).toBe(
      'E1113 output holds s.secret at (root): it would encode as "[secret]"',
    );
    expect(thrown(() => declare.action(s.object({ when: s.string().optional() })))).toBeNull();
  });
});
