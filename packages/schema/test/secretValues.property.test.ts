import { fixedTime } from "@keel/tooling/test-time";
// Seed 1337. The internal read @keel/server takes of each Secret a request makes: its strings, numbers and data keys,
// read beside the node it was sealed under, and never a declared field name.
import fc from "fast-check";
import { expect, test } from "vitest";
import { Secret } from "../src/Secret.ts";
import { gen } from "../src/gen.ts";
import { type Schema, piiValues, s } from "../src/index.ts";
import type { Node } from "../src/internal/Node.ts";
import { isRecord } from "../src/internal/isRecord.ts";
import { secretValues } from "../src/internal/secretValues.ts";

const opts = { seed: 1337, numRuns: 100 };
const json: Node = { kind: "json" };

const parsed = (schema: Schema<unknown, boolean>, x: unknown): unknown => {
  const r = schema.parse(x);
  if (!r.ok) throw new Error("the fixture does not parse");
  return r.value;
};

/** Every non-empty string, number (as `String()`) and own key at any depth: what reading a value whole gives. */
const whole = (x: unknown, out: Set<string> = new Set()): Set<string> => {
  if (typeof x === "string") {
    if (x !== "") out.add(x);
  } else if (typeof x === "number") out.add(String(x));
  else if (Array.isArray(x)) for (const v of x) whole(v, out);
  else if (isRecord(x))
    for (const [k, v] of Object.entries(x)) {
      whole(k, out);
      whole(v, out);
    }
  return out;
};

/** The read before keys: each string and number inside a secret, by value alone, no key. */
const valuesOnly = (x: unknown, inside = false, out: string[] = []): string[] => {
  let v = x;
  let at = inside;
  while (Secret.is(v)) {
    v = Secret.open(v);
    at = true;
  }
  if ((typeof v === "string" || typeof v === "number") && at && String(v) !== "") out.push(String(v));
  if (typeof v === "object" && v !== null) for (const item of Object.values(v)) valuesOnly(item, at, out);
  return out;
};

const formatted = <T>(name: string, base: Schema<T>) =>
  s.format(name, base, { check: () => true, gen: { from: base, map: (v: T) => v } });
const leaf = fc.constantFrom<Schema<unknown>>(
  s.string(),
  s.int(),
  s.number(),
  s.boolean(),
  s.enum(["a", "b"]),
  s.json(),
);
const fieldName = fc.stringMatching(/^F[A-Z]{3}$/);
/** Schemas with no `secret` node. */
const plain: fc.Arbitrary<Schema<unknown>> = fc.letrec<{ node: Schema<unknown> }>((tie) => ({
  node: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    leaf,
    tie("node").map((n) => s.array(n)),
    tie("node").map((n) => s.record(n)),
    tie("node").map((n) => n.nullable()),
    tie("node").map((n) => formatted("F", n)),
    fc.dictionary(fieldName, tie("node"), { maxKeys: 3 }).map((shape) => s.object(shape)),
  ),
})).node;
/** Schemas that may hold `secret` nodes at any depth. */
const sealed: fc.Arbitrary<Schema<unknown>> = fc.letrec<{ node: Schema<unknown> }>((tie) => ({
  node: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    leaf,
    leaf.map((l) => s.secret(l)),
    tie("node").map((n) => s.secret(n)),
    tie("node").map((n) => s.array(n)),
    tie("node").map((n) => s.record(n)),
    tie("node").map((n) => n.nullable()),
    fc.dictionary(fieldName, tie("node"), { maxKeys: 3 }).map((shape) => s.object(shape)),
  ),
})).node;
const withValue = (schemas: fc.Arbitrary<Schema<unknown>>) =>
  schemas.chain((schema) => fc.tuple(fc.constant(schema), gen(schema)));

/** The declared field names of every object node under `node`. */
const declared = (node: Node, out: Set<string> = new Set()): Set<string> => {
  if (node.kind === "object")
    for (const [k, f] of Object.entries(node.fields)) {
      out.add(k);
      declared(f, out);
    }
  else if (node.kind === "array") declared(node.item, out);
  else if (node.kind === "record") declared(node.value, out);
  else if (node.kind === "nullable" || node.kind === "optional" || node.kind === "secret") declared(node.inner, out);
  else if (node.kind === "format") declared(node.base, out);
  return out;
};

test("a secret gives the set piiValues gives for the same schema marked whole", () => {
  fc.assert(
    fc.property(withValue(plain), ([schema, x]) => {
      const got = new Set(secretValues(parsed(s.secret(schema), x)));
      expect(got).toEqual(new Set(piiValues(schema.pii("content"), schema.encode(x))));
    }),
    opts,
  );
});

test("a declared field name is never given, at any depth", () => {
  fc.assert(
    fc.property(withValue(sealed), ([schema, x]) => {
      const got = secretValues(parsed(schema, x));
      const data = dataOf(schema.node, x);
      for (const k of declared(schema.node)) if (!data.has(k)) expect(got).not.toContain(k);
    }),
    opts,
  );
});

/** Every string, number and data key `x` holds under `node`: all it holds but its declared field names. */
function dataOf(node: Node, x: unknown): Set<string> {
  const data = new Set<string>();
  const walk = (n: Node, v: unknown): void => {
    let at = n;
    while (at.kind === "nullable" || at.kind === "optional" || at.kind === "format" || at.kind === "secret")
      at = at.kind === "format" ? at.base : at.inner;
    const raw = Secret.is(v) ? Secret.open(v) : v;
    if (at.kind === "object" && isRecord(raw)) {
      for (const [k, f] of Object.entries(at.fields)) if (Object.hasOwn(raw, k)) walk(f, raw[k]);
    } else if (at.kind === "array" && Array.isArray(raw)) for (const item of raw) walk(at.item, item);
    else if (at.kind === "record" && isRecord(raw))
      for (const [k, item] of Object.entries(raw)) {
        data.add(k);
        walk(at.value, item);
      }
    else whole(raw, data);
  };
  walk(node, x);
  return data;
}

test("every key of a record value and of a json value at any depth is given", () => {
  fc.assert(
    fc.property(withValue(plain.map((p) => s.record(p))), ([schema, x]) => {
      const got = secretValues(parsed(s.secret(schema), x));
      for (const k of isRecord(x) ? Object.keys(x) : []) if (k !== "") expect(got).toContain(k);
    }),
    opts,
  );
  fc.assert(
    fc.property(fc.jsonValue(), (x) => {
      expect(new Set(secretValues(parsed(s.secret(s.json()), x)))).toEqual(whole(x));
    }),
    opts,
  );
});

test("an object's undeclared keys and values are given whole, open or closed; its declared names are not", () => {
  const extra = fc.dictionary(fc.stringMatching(/^x[a-z]{2}$/), fc.jsonValue(), { minKeys: 1, maxKeys: 3 });
  fc.assert(
    fc.property(extra, fc.string({ minLength: 1 }), fc.boolean(), (more, v, closed) => {
      const node: Node = { kind: "object", fields: { FKEY: s.string().node }, closed };
      const got = secretValues(Secret.of({ FKEY: v, ...more }, node));
      expect(new Set(got)).toEqual(whole([v, more]));
      if (v !== "FKEY") expect(got).not.toContain("FKEY");
    }),
    opts,
  );
  const open = parsed(s.secret(s.object({ flag: s.boolean(), key: s.string() })), {
    flag: true,
    key: "k-1",
    nick: "n",
  });
  expect(secretValues(open)).toEqual(["k-1", "nick", "n"]);
});

test("a value no union variant or anyOf member fits is given whole", () => {
  const tagged = s.union("t", [s.object({ t: s.literal("a"), FVAL: s.string() }), s.object({ t: s.literal("b") })]);
  const members = s.union([s.int(), s.object({ FVAL: s.string() }, { closed: true })]);
  const stray = fc
    .dictionary(fc.string(), fc.jsonValue(), { maxKeys: 4, noNullPrototype: true })
    .map((d) => ({ ...d, t: "zzz" }));
  fc.assert(
    fc.property(stray, (x) => {
      expect(new Set(secretValues(Secret.of(x, tagged.node)))).toEqual(whole(x));
      expect(new Set(secretValues(Secret.of(x, members.node)))).toEqual(whole(x));
    }),
    opts,
  );
  // A value a variant or member fits is read under it, so its declared name stays out.
  expect(secretValues(parsed(s.secret(tagged), { t: "a", FVAL: "v-1" }))).toEqual(["a", "v-1"]);
  expect(secretValues(parsed(s.secret(members), { FVAL: "v-2" }))).toEqual(["v-2"]);
});

test("a value whose shape is not its node's is given whole", () => {
  expect(new Set(secretValues(Secret.of({ k1: ["v1"] }, s.string().node)))).toEqual(new Set(["k1", "v1"]));
  expect(new Set(secretValues(Secret.of({ k2: 2 }, s.array(s.int()).node)))).toEqual(new Set(["k2", "2"]));
  expect(secretValues(Secret.of(["e1"], s.record(s.string()).node))).toEqual(["e1"]);
});

test("a secret inside a secret gives the inner one's values once, by its own node", () => {
  const schema = s.secret(s.object({ FIN: s.secret(s.record(s.string())), FOUT: s.string() }));
  const value = parsed(schema, { FIN: { "acct-7f3a9c": "x-1", "": "x-2" }, FOUT: "y-1" });
  expect(secretValues(value)).toEqual(["acct-7f3a9c", "x-1", "x-2", "y-1"]);
  fc.assert(
    fc.property(withValue(plain), ([inner, x]) => {
      const once = secretValues(parsed(s.secret(inner), x));
      const twice = secretValues(parsed(s.secret(s.object({ FWRAP: s.secret(inner) })), { FWRAP: x }));
      expect(twice).toEqual(once);
    }),
    opts,
  );
});

test("a secret's empty keys and strings are left out, and a boolean is not a value", () => {
  const value = parsed(s.secret(s.record(s.boolean())), { "": true, on: false });
  expect(secretValues(value)).toEqual(["on"]);
  expect(secretValues(Secret.of({ "": "", a: [true, ""] }, json))).toEqual(["a"]);
});

test("every value the read by value alone gives is still given", () => {
  fc.assert(
    fc.property(withValue(sealed), ([schema, x]) => {
      const value = parsed(schema, x);
      const got = new Set(secretValues(value));
      for (const v of valuesOnly(value)) expect(got).toContain(v);
    }),
    opts,
  );
});

// Two reads of about 1,000,000 values each: about 0.2 us a value here, so 5 us a value bounds them with a margin of
// twenty-five.
test(
  "a 1,000,000-deep json secret returns without overflowing the stack, and gives nothing past the visit cap",
  {
    timeout: fixedTime(2 * 1_000_000 * 0.005),
  },
  () => {
    let deep: unknown = "bottom";
    for (let i = 0; i < 1_000_000; i++) deep = [deep];
    expect(secretValues(Secret.of(deep, json))).toEqual([]);
    let shallow: unknown = "bottom";
    for (let i = 0; i < 999_998; i++) shallow = [shallow];
    expect(secretValues(Secret.of(shallow, json))).toEqual(["bottom"]);
  },
);

test("Secret.innerOf gives the node a secret was made under, and the secret stays frozen", () => {
  const nodes = fc.constantFrom<Node>(json, s.string().node, s.record(s.int()).node, s.object({ a: s.json() }).node);
  fc.assert(
    fc.property(fc.jsonValue(), nodes, (v, n) => {
      const made = Secret.of(v, n);
      expect(Secret.innerOf(made)).toBe(n);
      expect(Object.isFrozen(made)).toBe(true);
    }),
    opts,
  );
  const inner = s.record(s.string());
  const value = parsed(s.secret(inner), { a: "b" });
  expect(Secret.is(value) && Secret.innerOf(value)).toBe(inner.node);
});
