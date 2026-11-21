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
