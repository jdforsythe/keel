// fast-check seed: 1337
// k.privacy: for any schema, the class lookup behind `data-k-pii` gives every path `piiPaths` lists the class it
// lists; a `*` entry is looked up as `0`, an array index, a record key and an undeclared key alike.
import { type PiiClass, type Schema, piiPaths, s } from "@keel/schema";
import fc from "fast-check";
import { expect, it } from "vitest";
import { piiClassAt } from "../src/internal/piiClassAt.ts";

fc.configureGlobal({ seed: 1337, numRuns: 300 });

const classes: readonly PiiClass[] = ["name", "contact", "location", "special"];
const mark = fc.option(fc.constantFrom(...classes), { freq: 3 });
const marked = (schema: Schema<unknown>, cls: PiiClass | null): Schema<unknown> =>
  cls === null ? schema : schema.pii(cls);
const key = fc.constantFrom("a", "b", "c", "d");
/** An object's fields, each optional or not, with an optional's own mark. */
const shapeOf = (node: fc.Arbitrary<Schema<unknown>>) =>
  fc.dictionary(
    key,
    fc
      .tuple(node, fc.boolean(), mark)
      .map(([n, opt, c]): Schema<unknown, boolean> => (opt ? (c === null ? n.optional() : n.optional().pii(c)) : n)),
    { maxKeys: 3, noNullPrototype: true },
  );
const variant = (
  tag: string,
  shape: Readonly<Record<string, Schema<unknown, boolean>>>,
  closed: boolean,
  cls: PiiClass | null,
) => {
  const obj = s.object({ ...shape, t: s.literal(tag) }, { closed });
  return cls === null ? obj : obj.pii(cls);
};

const schemas: fc.Arbitrary<Schema<unknown>> = fc.letrec<{ node: Schema<unknown> }>((tie) => ({
  node: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    fc.tuple(fc.constantFrom<Schema<unknown>>(s.string(), s.int(), s.json()), mark).map(([n, c]) => marked(n, c)),
    fc.tuple(tie("node"), mark).map(([n, c]) => marked(s.array(n), c)),
    fc.tuple(tie("node"), mark).map(([n, c]) => marked(s.record(n), c)),
    fc
      .tuple(shapeOf(tie("node")), fc.boolean(), mark)
      .map(([shape, closed, c]) => marked(s.object(shape, { closed }), c)),
    fc
      .tuple(fc.array(fc.tuple(shapeOf(tie("node")), fc.boolean(), mark), { minLength: 2, maxLength: 3 }), mark)
      .map(([vs, c]) => {
        const [x, y, z] = vs.map(([shape, closed, vc], i) => variant(["p", "q", "r"][i] ?? "r", shape, closed, vc));
        if (x === undefined || y === undefined) throw new Error("two variants at least");
        return marked(z === undefined ? s.union("t", [x, y]) : s.union("t", [x, y, z]), c);
      }),
  ),
})).node;

it("every path `piiPaths` lists with a class gets that class from the lookup", () => {
  fc.assert(
    fc.property(schemas, (schema) => {
      for (const { path, class: cls } of piiPaths(schema)) {
        const segs = path === "" ? [] : path.split(".").map((seg) => (seg === "*" ? "0" : seg));
        expect([path, piiClassAt(schema.node, segs)]).toEqual([path, cls]);
      }
    }),
  );
});
