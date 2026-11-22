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

test("a file importing `database` from @keel/std-postgres is one; importing only `sql` is not", () => {
  expect(
    registersCapability(
      'import { database } from "@keel/std-postgres";\nexport const db = database("notes.db", {});\n',
    ),
  ).toBe(true);
  expect(registersCapability('import { sql } from "@keel/std-postgres";\n')).toBe(false);
});

test("a subpath of either package is the package: `database` from @keel/std-postgres/server is one", () => {
  fc.assert(
    fc.property(body, fc.constantFrom("@keel/std-postgres/server", "@keel/std-postgres"), (text, from) => {
      expect(
        registersCapability(`import { database } from "${from}";\n${text}\nexport const d = database("a.db");\n`),
      ).toBe(true);
      expect(registersCapability(`import { sql } from "${from}";\n${text}\n`)).toBe(false);
    }),
    FC,
  );
  expect(registersCapability('import { register } from "@keel/ctx/internal";\n')).toBe(true);
  expect(registersCapability('import { database } from "@keel/std-postgresql";\n')).toBe(false);
});
