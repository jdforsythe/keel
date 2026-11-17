// Spec: k.reveal, Flow "A `return` is not a sink: an API action's `output` is where a revealed value leaves on purpose (k.api)."
// Spec: k.reveal, Conformance "`return ok({ token: reveal(p.k) })` in an action is none."
// Seed: 1337.
// Loose: the spec gives no exact message or column, so findings are asserted by code and count.
import { check } from "@keel/check";
import { describe, expect, test } from "vitest";
import type { Files } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = f(
  "modules/accounts/module.ts",
  "import { module } from '@keel/compiler'\nexport default module({ id: 'accounts', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n",
);

const POST_TOKEN = `import { action } from "@keel/router";
import { err, ok, reveal } from "@keel/schema";
import { credentials } from "@keel/std-credentials/server";
import { tx } from "@keel/store";
import { NewToken } from "./NewToken.schema.ts";
import { Nothing } from "./Nothing.schema.ts";
import { accountStores } from "./accountStores.ts";

/** \`POST /api/tokens\`: a new API token for this caller, good for 90 days, answered once and stored as its digest. */
export const postToken = action(
  { input: Nothing, output: NewToken, stores: accountStores },
  (_input, { caller, stores }, ctx) => {
    const minted = credentials(ctx).mint({ ttl: 90 * 86_400_000 });
    if (!minted.ok) return err(minted.error);
    const { id, digest, expiresAt, token } = minted.value;
    const r = tx(stores.addToken, { id, digest, owner: caller });
    return r.ok ? ok({ token: reveal(token), id, expiresAt }) : err(r.error);
  },
);
`;
const FILE = "modules/accounts/postToken.server.ts";
const codes = (files: Files, code: string): number =>
  check(files, { types: false }).diagnostics.filter((d) => d.code === code).length;

const HEAD = ["import { reveal } from '@keel/schema'", "import { ok } from '@keel/schema'"].join("\n");
const body = (lines: string[]): Files => [
  MANIFEST,
  f(FILE, `${HEAD}\nexport async function act(ctx, p) {\n${lines.map((l) => `  ${l}`).join("\n")}\n}\n`),
];

describe("k.reveal: a return is not a sink", () => {
  test("`postToken` of the RFC's Example reports no E1112 and no E1105; the same file with `owner: reveal(token)` in `tx` is one E1112.", () => {
    const files = [MANIFEST, f(FILE, POST_TOKEN)];
    expect(codes(files, "E1112")).toBe(0);
    expect(codes(files, "E1105")).toBe(0);
    const leaking = POST_TOKEN.replace("owner: caller", "owner: reveal(token)");
    expect(leaking).not.toBe(POST_TOKEN);
    const bad = [MANIFEST, f(FILE, leaking)];
    expect(codes(bad, "E1112")).toBe(1);
  });

  test("`return ok({ token: reveal(p.k) })` in an action is none.", () => {
    for (const lines of [
      ["return ok({ token: reveal(p.k) })"],
      ["const token = reveal(p.k)", "return ok({ token })"],
      ["return ok({ nested: { token: reveal(p.k) }, list: [reveal(p.k)] })"],
    ]) {
      expect(codes(body(lines), "E1112"), lines.join(";")).toBe(0);
    }
  });

  test("`return reveal(p.k)` in an action is none.", () => {
    for (const lines of [["return reveal(p.k)"], ["const t = reveal(p.k)", "return t"], ["return `${reveal(p.k)}`"]]) {
      expect(codes(body(lines), "E1112"), lines.join(";")).toBe(0);
    }
    expect(codes(body(["console.log(reveal(p.k))", "return ok({})"]), "E1112")).toBe(1);
  });
});
