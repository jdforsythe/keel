// k.data Dev: a file that may call `@keel/ctx`'s `register` reloads the whole server graph in `keel dev`.
import fc from "fast-check";
import { expect, test } from "vitest";
import { registersCapability } from "../src/internal/registersCapability.ts";

const FC = { seed: 1337, numRuns: 50 };
const body = fc.string({ maxLength: 40 }).filter((s) => !/register|@keel/.test(s));

test("a file importing `register` from @keel/ctx is one, whatever surrounds the import", () => {
  fc.assert(
    fc.property(body, body, fc.constantFrom('"', "'"), (before, after, q) => {
      const src = `${before}\nimport { register } from ${q}@keel/ctx${q};\n${after}`;
      expect(registersCapability(src)).toBe(true);
    }),
    FC,
  );
});

test("a file not importing @keel/ctx, or not naming `register`, is not one", () => {
  fc.assert(
    fc.property(body, (text) => {
      expect(registersCapability(`import { createCtx } from "@keel/ctx";\n${text}`)).toBe(false);
      expect(registersCapability(`import { register } from "./local.ts";\n${text}`)).toBe(false);
    }),
    FC,
  );
});

test("a namespace import calling `.register` is one; a name that only contains `register` is not", () => {
  expect(registersCapability('import * as k from "@keel/ctx";\nk.register("a.b", impls);\n')).toBe(true);
  expect(registersCapability('import { createCtx } from "@keel/ctx";\nconst registered = 1;\n')).toBe(false);
});

test("a subpath of @keel/ctx is the package", () => {
  expect(registersCapability('import { register } from "@keel/ctx/internal";\n')).toBe(true);
});

// k.server-deps Registration through a library: a name imported from a library counts when `library(spec, name)` holds.
/** Text around the imports that keeps the file parsing: a line comment. */
const comment = body.map((t) => `// ${t.replace(/[\n\r\u2028\u2029]/g, " ")}`);

test("a file importing a name `library` holds is one, under any local name and as a re-export; any other name is not", () => {
  const library = (spec: string, name: string): boolean => spec === "@acme/store" && name === "store";
  fc.assert(
    fc.property(comment, fc.constantFrom("store", "keep"), fc.constantFrom('"', "'"), (text, local, q) => {
      const as = local === "store" ? "store" : `store as ${local}`;
      expect(registersCapability(`import { ${as} } from ${q}@acme/store${q};\n${text}\n`, library)).toBe(true);
      expect(registersCapability(`export { store } from ${q}@acme/store${q};\n${text}\n`, library)).toBe(true);
      expect(registersCapability(`import { other } from ${q}@acme/store${q};\n${text}\n`, library)).toBe(false);
      expect(registersCapability(`import { store } from ${q}@acme/other${q};\n${text}\n`, library)).toBe(false);
    }),
    FC,
  );
});

test("a type-only import of a registering name is not one; a namespace import asks for `*`", () => {
  const seen: string[] = [];
  const library = (spec: string, name: string): boolean => {
    seen.push(`${spec} ${name}`);
    return name === "store" || name === "*";
  };
  expect(registersCapability('import type { store } from "@acme/store";\n', library)).toBe(false);
  expect(registersCapability('import { type store } from "@acme/store";\n', library)).toBe(false);
  expect(registersCapability('import * as s from "@acme/store";\n', library)).toBe(true);
  expect(seen).toEqual(["@acme/store *"]);
});

test("a file that does not parse counts when a specifier it names has a registering export", () => {
  const library = (spec: string, name: string): boolean => spec === "@acme/store" && name === "*";
  expect(registersCapability('import { other } from "@acme/store";\nconst = ;\n', library)).toBe(true);
  expect(registersCapability('import { other } from "@acme/plain";\nconst = ;\n', library)).toBe(false);
});
