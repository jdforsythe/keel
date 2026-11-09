// Spec: k.store, clause "E1303 fires on a state schema with a nested `s.secret` and on `reveal` in a transaction function, not on their clean twins."
// Seed 1337
// E1303 has no fix; the no-fix list in fix-diffs.test.ts records it.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import type { Files } from "./support.ts";
import { SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = f(
  "modules/app/module.ts",
  `import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`,
);
const e1303 = (files: Files) =>
  check([MANIFEST, ...files], { types: false }).diagnostics.filter((d) => d.code === "E1303");

const S = `import { s } from '@keel/schema'\n`;
const STORE = `import { store } from '@keel/store'\n`;
const INIT = `{ creds: { token: '' } }`;
const cartFile = (stateRef: string, imports = `import { State } from './State.schema.ts'\n`, call = "store") =>
  f("modules/app/cart.ts", `${STORE}${imports}export const cart = ${call}(${stateRef}, ${INIT})\n`);
const stateSchema = (leaf: string) =>
  f("modules/app/State.schema.ts", `${S}export const State = s.object({ creds: s.object({ token: ${leaf} }) })\n`);

const SECRET = "s.secret(s.string())";
const PLAIN = "s.string()";

test("E1303 fires on `store(State, ...)` when an imported State schema nests `s.secret` in an `s.object` field", () => {
  const ds = e1303([stateSchema(SECRET), cartFile("State")]);
  expect(ds).toHaveLength(1);
  expect(ds[0]?.fix).toBeUndefined();
  expect(ds[0]?.see).toBe("k.store");
});

test("E1303 does not fire when the same State schema holds `s.string()` in place of `s.secret`", () => {
  expect(e1303([stateSchema(PLAIN), cartFile("State")])).toHaveLength(0);
});

test("E1303 fires on `store(...)` with an inline state schema nesting `s.secret`", () => {
  const inline = (leaf: string) =>
    f(
      "modules/app/cart.ts",
      `${S}${STORE}export const cart = store(s.object({ creds: s.object({ token: ${leaf} }) }), ${INIT})\n`,
    );
  expect(e1303([inline(SECRET)])).toHaveLength(1);
  expect(e1303([inline(PLAIN)])).toHaveLength(0);
});

test("E1303 fires on a state schema with `s.secret` inside `s.array(...)`, and not with `s.string()` there", () => {
  const arr = (leaf: string) =>
    f("modules/app/State.schema.ts", `${S}export const State = s.object({ tokens: s.array(${leaf}) })\n`);
  expect(e1303([arr(SECRET), cartFile("State")])).toHaveLength(1);
  expect(e1303([arr(PLAIN), cartFile("State")])).toHaveLength(0);
});

test("E1303 fires when the nested object schema is a separate const imported from another schema file", () => {
  const creds = (leaf: string) =>
    f("modules/app/Creds.schema.ts", `${S}export const Creds = s.object({ token: ${leaf} })\n`);
  const state = f(
    "modules/app/State.schema.ts",
    `${S}import { Creds } from './Creds.schema.ts'\nexport const State = s.object({ creds: Creds })\n`,
  );
  expect(e1303([creds(SECRET), state, cartFile("State")])).toHaveLength(1);
  expect(e1303([creds(PLAIN), state, cartFile("State")])).toHaveLength(0);
});

test("E1303 fires through an aliased `store` import", () => {
  const aliased = cartFile("State", `import { State } from './State.schema.ts'\n`, "mk").source.replace(
    `import { store } from '@keel/store'`,
    `import { store as mk } from '@keel/store'`,
  );
  const file = f("modules/app/cart.ts", aliased);
  expect(e1303([stateSchema(SECRET), file])).toHaveLength(1);
  expect(e1303([stateSchema(PLAIN), file])).toHaveLength(0);
});

test("E1303 does not fire on an `s.secret` that only appears in a transaction's payload schema", () => {
  const cart = f(
    "modules/app/cart.server.ts",
    `${S}${STORE}import { State } from './State.schema.ts'\n` + `export const cart = store(State, ${INIT})\n`,
  );
  const login = f(
    "modules/app/login.server.ts",
    `${S}import { transaction } from '@keel/store'\nimport { cart } from './cart.server.ts'\nexport const login = transaction(cart, 'cart.login', s.object({ token: s.secret(s.string()) }), (st) => st)\n`,
  );
  expect(e1303([stateSchema(PLAIN), cart, login])).toHaveLength(0);
});

const TX_HEAD = `import { transaction } from '@keel/store'\nimport { cart } from './cart.ts'\nimport { Login } from './Login.schema.ts'\n`;
const LOGIN = f("modules/app/Login.schema.ts", `${S}export const Login = s.object({ token: s.secret(s.string()) })\n`);
const CART = f("modules/app/cart.ts", `${STORE}export const cart = store({}, { label: '' })\n`);
const tx = (reveal: string, label: string, head = `import { reveal } from '@keel/schema'\n`) =>
  f(
    "modules/app/login.server.ts",
    `${head}${TX_HEAD}export const login = transaction(cart, 'cart.login', Login, (st, p) => ({ ...st, label: ${label.replace(
      "REVEAL",
      reveal,
    )} }))\n`,
  );

test("E1303 fires on `reveal` called in a transaction function", () => {
  const ds = e1303([CART, LOGIN, tx("reveal", "REVEAL(p.token)")]);
  expect(ds).toHaveLength(1);
  expect(ds[0]?.fix).toBeUndefined();
  expect(ds[0]?.see).toBe("k.store");
});

test("E1303 fires on `reveal` called through an aliased import in a transaction function", () => {
  const head = `import { reveal as r } from '@keel/schema'\n`;
  expect(e1303([CART, LOGIN, tx("r", "REVEAL(p.token)", head)])).toHaveLength(1);
});

test("E1303 fires on `schema.reveal` called through a namespace import in a transaction function", () => {
  const head = `import * as schema from '@keel/schema'\n`;
  expect(e1303([CART, LOGIN, tx("schema.reveal", "REVEAL(p.token)", head)])).toHaveLength(1);
});

test("E1303 does not fire on the same transaction without `reveal`", () => {
  expect(e1303([CART, LOGIN, tx("reveal", "'in'")])).toHaveLength(0);
});

test("E1303 does not fire on `reveal` used in the same file outside the transaction function", () => {
  const src = `import { reveal } from '@keel/schema'\n${TX_HEAD}export const show = (p: { token: never }) => reveal(p.token)\n`;
  const clean = f(
    "modules/app/login.server.ts",
    `${src}export const login = transaction(cart, 'cart.login', Login, (st) => st)\n`,
  );
  expect(e1303([CART, LOGIN, clean])).toHaveLength(0);
});

// Seed 1337
test("Property: over every nesting depth, a state schema with `s.secret` reports one E1303 and its clean twin none", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 6 }), fc.constantFrom("object", "array"), (depth, wrap) => {
      const build = (leaf: string): string => {
        let expr = leaf;
        for (let i = 0; i < depth; i++) expr = wrap === "object" ? `s.object({ k: ${expr} })` : `s.array(${expr})`;
        return expr;
      };
      const file = (leaf: string) =>
        f("modules/app/State.schema.ts", `${S}export const State = s.object({ top: ${build(leaf)} })\n`);
      expect(e1303([file(SECRET), cartFile("State")])).toHaveLength(1);
      expect(e1303([file(PLAIN), cartFile("State")])).toHaveLength(0);
    }),
    { seed: SEED, numRuns: 30 },
  );
});
