import { check } from "@keel/check";
import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vitest";
import { redactPath } from "../src/redactPath.ts";

type F = { path: string; source: string };
const manifest = (redact: readonly string[], list = "redact"): F => ({
  path: "modules/cart/module.ts",
  source: `import { module } from '@keel/compiler'
export default module({
  id: 'cart',
  std: { '@keel/std-sessions': { ${list}: ${JSON.stringify(redact)} } },
})
`,
});
const code = (source: string): F => ({ path: "modules/cart/cart.ts", source });
const PRE = "import { s } from '@keel/schema'\nimport { store, transaction } from '@keel/store'\n";
const PAY = `${PRE}const cart = store(s.object({ card: s.string() }), { card: '' }, { id: 'cart' })
export const pay = transaction(cart, 'cart.pay', s.object({
  card: s.object({ number: s.string(), history: s.array(s.object({ at: s.int() })).optional() }),
  meta: s.json(),
  note: s.secret(s.string()).nullable(),
}), (st) => st)\n`;
const e2001 = (files: readonly F[]) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E2001");
const bad = (redact: readonly string[], ...rest: F[]) => e2001([manifest(redact), ...rest]).length;

describe("E2001 redactPath", () => {
  test("tx: valid, nested, array star, json, secret/nullable", () => {
    const ok = [
      "tx:cart.pay#card.number",
      "tx:cart.pay#card.history.*.at",
      "tx:cart.pay#meta.deep.x",
      "tx:cart.pay#note",
    ];
    expect(bad(ok, code(PAY))).toBe(0);
  });
  test("tx: absent field, past a leaf, bad array segment", () => {
    expect(bad(["tx:cart.pay#card.nope"], code(PAY))).toBe(1);
    expect(bad(["tx:cart.pay#card.number.x"], code(PAY))).toBe(1);
    expect(bad(["tx:cart.pay#card.history.x"], code(PAY))).toBe(1);
  });
  test("subject, module, and shape errors with messages", () => {
    const d = e2001([manifest(["bogus:cart.pay#a", "tx:orders.pay#a", "nonsense"])]);
    expect(d.map((x) => x.message)).toEqual([
      "redact entry 'bogus:cart.pay#a' has unknown subject 'bogus'",
      "redact entry 'tx:orders.pay#a' targets module 'orders', not 'cart'",
      "redact entry 'nonsense' is not <subject>:<target>#<path>",
    ]);
  });
  test("store", () => {
    const src = code(PAY);
    expect(bad(["store:cart#card"], src)).toBe(0);
    expect(bad(["store:cart#nope"], src)).toBe(1);
  });
  test("route params and search", () => {
    const routes: F = {
      path: "modules/cart/routes.ts",
      source: `import { manifest } from '@keel/router'
import { s } from '@keel/schema'
export const routes = manifest({ 'cart.show': { path: '/c', params: s.object({ id: s.string() }), search: s.object({ q: s.string() }) } })\n`,
    };
    expect(bad(["route:cart.show#params.id", "route:cart.show#search.q"], routes)).toBe(0);
    expect(bad(["route:cart.show#params.q", "route:cart.show#search.id", "route:cart.show#body.x"], routes)).toBe(3);
  });
  test("el accepts only value", () => {
    expect(bad(["el:cart.card#value"])).toBe(0);
    expect(bad(["el:cart.card#text"])).toBe(1);
  });
  test("error data", () => {
    const err = code(`${PRE}export const Declined = s.error('cart.declined', s.object({ code: s.string() }))\n`);
    expect(bad(["error:cart.declined#data.code"], err)).toBe(0);
    expect(bad(["error:cart.declined#data.nope"], err)).toBe(1);
    expect(bad(["error:cart.unknown#data.nope"], err)).toBe(0);
  });
  test("identifier-bound const schema", () => {
    const src = code(`${PRE}const Pay = s.object({ card: s.object({ number: s.string() }) })
export const pay = transaction(cartStore, 'cart.pay', Pay, (st) => st)\n`);
    expect(bad(["tx:cart.pay#card.number"], src)).toBe(0);
    expect(bad(["tx:cart.pay#card.nope"], src)).toBe(1);
  });
  test("./X.schema.ts import", () => {
    const schema: F = {
      path: "modules/cart/Pay.schema.ts",
      source: "import { s } from '@keel/schema'\nexport const Pay = s.object({ card: s.string() })\n",
    };
    const src = code("import { Pay } from './Pay.schema.ts'\nexport const pay = transaction(c, 'cart.pay', Pay, f)\n");
    expect(bad(["tx:cart.pay#card"], src, schema)).toBe(0);
    expect(bad(["tx:cart.pay#nope"], src, schema)).toBe(1);
  });
  test("unresolvable schemas are not reported", () => {
    const call = code("export const a = transaction(c, 'cart.pay', make(), f)\n");
    const spread = code(`${PRE}export const a = transaction(c, 'cart.pay', s.object({ ...base, x: s.string() }), f)\n`);
    const other = code("import { P } from '../orders/P.ts'\nexport const a = transaction(c, 'cart.pay', P, f)\n");
    expect(bad(["tx:cart.pay#whatever"], call)).toBe(0);
    expect(bad(["tx:cart.pay#whatever"], spread)).toBe(0);
    expect(bad(["tx:cart.pay#whatever"], other)).toBe(0);
    expect(bad(["tx:cart.pay#x"], spread)).toBe(0);
  });
  test("expose entries are checked too", () => {
    const d = e2001([manifest(["tx:cart.pay#card.nope"], "expose"), code(PAY)]);
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toContain("expose entry");
  });
  test("other files are not module manifests", () => {
    expect(e2001([{ path: "modules/cart/other.ts", source: manifest(["bogus:x#y"]).source }])).toHaveLength(0);
  });
  test("fix removes the entry and the result re-checks clean", () => {
    for (const redact of [
      ["tx:cart.pay#card.nope", "tx:cart.pay#card.number"],
      ["tx:cart.pay#card.number", "tx:cart.pay#card.nope"],
      ["tx:cart.pay#card.nope"],
    ]) {
      const m = manifest(redact);
      const input = (path: string, source: string) => {
        const { program } = parseSync(path, source, { sourceType: "module", lang: "ts" });
        return { file: { path, source }, ast: program };
      };
      const files = [m, code(PAY)];
      const found = redactPath.check({
        ...input(m.path, m.source),
        artifacts: {},
        project: files,
      });
      expect(found).toHaveLength(1);
      const [f] = found;
      const edits = f === undefined ? null : redactPath.fix?.(f, input(m.path, m.source));
      expect(edits).not.toBeNull();
      let src = m.source;
      for (const e of [...(edits ?? [])].sort((a, b) => b.start - a.start))
        src = src.slice(0, e.start) + e.text + src.slice(e.end);
      expect(e2001([{ path: m.path, source: src }, code(PAY)])).toHaveLength(0);
    }
  });
});
