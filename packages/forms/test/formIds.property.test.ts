// @vitest-environment happy-dom
// fast-check seed: 1337
import { scope } from "@keel/reactive";
import { type ObjectSchema, s } from "@keel/schema";
import fc from "fast-check";
import { afterEach, expect, it } from "vitest";
import { form } from "../src/index.ts";

fc.configureGlobal({ seed: 1337, numRuns: 100 });

const key = fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/).filter((k) => !["constructor", "prototype"].includes(k));
const shape = fc.dictionary(key, fc.constantFrom("str", "num", "bool"), {
  minKeys: 1,
  maxKeys: 5,
  noNullPrototype: true,
});
const build = (d: Readonly<Record<string, string>>): ObjectSchema<object> =>
  s.object(
    Object.fromEntries(
      Object.entries(d).map(([k, t]) => [k, t === "str" ? s.string() : t === "num" ? s.number() : s.boolean()]),
    ),
  );
const idText = fc.stringMatching(/^[a-z][a-z.]{0,10}$/);

const scopes: { dispose(): void }[] = [];
afterEach(() => {
  for (const sc of scopes.splice(0)) sc.dispose();
});
/** Field ids of a fresh form, created in its own render root (one scope per call). */
function ids(schema: ObjectSchema<object>, id?: string): string[] {
  let out: string[] = [];
  scopes.push(
    scope(
      () => {
        const f = form(schema, id === undefined ? {} : { id });
        out = Object.keys(schema.node.kind === "object" ? schema.node.fields : {}).map((k) => f.field(k).id);
      },
      { detached: true },
    ),
  );
  return out;
}

it("same schema and id give the same field ids across fresh form() calls, whatever was created between", () => {
  fc.assert(
    fc.property(shape, fc.option(idText, { nil: undefined }), (d, id) => {
      const first = ids(build(d), id);
      ids(build({ other: "str" }), "noise");
      ids(build({ other2: "num" }));
      expect(ids(build(d), id)).toEqual(first);
    }),
  );
});

it("different explicit ids give disjoint field ids", () => {
  fc.assert(
    fc.property(shape, idText, idText, (d, a, b) => {
      fc.pre(a !== b);
      const left = new Set(ids(build(d), a));
      expect(ids(build(d), b).some((i) => left.has(i))).toBe(false);
    }),
  );
});

it("ids survive a simulated server render then client resume (many forms before, fresh root)", () => {
  fc.assert(
    fc.property(shape, fc.nat(20), (d, before) => {
      for (let i = 0; i < before; i += 1) ids(build(d));
      const server = ids(build(d));
      for (let i = 0; i < before; i += 1) ids(build({ z: "bool" }));
      const client = ids(build(d));
      expect(client).toEqual(server);
    }),
  );
});

it("duplicate forms in one render root get distinct ids, deterministically", () => {
  fc.assert(
    fc.property(shape, (d) => {
      const run = (): string[] => {
        const out: string[] = [];
        scopes.push(
          scope(
            () => {
              const schema = build(d);
              for (const k of Object.keys(d)) {
                out.push(form(schema).field(k).id, form(schema).field(k).id);
              }
            },
            { detached: true },
          ),
        );
        return out;
      };
      const a = run();
      expect(new Set(a).size).toBe(a.length);
      expect(run()).toEqual(a);
    }),
  );
});
