// Spec: k.values, clause "`shadow: { a: '0 1px 2px rgb(0 0 0 / 0.2)' }` and `overlay: { scrim: { value: '#1a191e99', over: ['card'] } }` with a color token `card` are accepted; `overlay: { scrim: { value: '#1a191e', over: ['card'] } }`, one with `over: []`, and one with `over: ['nope']` are each refused with rule `format`, the last at `overlay.scrim.over`."
// Seed: 1337 (fixed project). No `test.skip`: the case is a plain test and fails until RFC 0249 is built.
// The `keel check` half of the clause's `over: ['nope']`: an `over` naming no color token the same tokens hold fails `TokenSchema` at `overlay.<name>.over`, so the project's `tokens.ts` is E1807 at the `over` key (k.values Overlays, k.themes Token errors) with message `overlay.scrim.over: names no color token "nope"`, and no element is judged: no E1804 or E1817 is reported for an element using the overlay. The unlisted-backdrop E1817 (check only) is packages/check/conformance/combinations.test.ts; that the render check reports no E1817 is a harness case owed to RFC 0244's runner.
// ASSUMED, as a11y-static-codes-cli.test.ts: a diagnostic record is `{ kind: "diag", code, path, line, col }`.
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, it } from "vitest";
import { TOPOLOGY, keelProject } from "./a11y-project-support.ts";
import { keel, removeProject } from "./test-sim-project.ts";

const created: string[] = [];
afterAll(() => {
  for (const d of created) removeProject(d);
});
const MODULE = `import { module } from "@keel/compiler";\nexport default module({ id: "m", deps: [], capabilities: [], public: { exports: [] } });\n`;
const tokens = (over: string): string =>
  `import { defineTokens } from "@keel/ui/tokens";\nexport const tokens = defineTokens({ color: { card: "#ffffff", on: "#ffffff" }, overlay: { scrim: { value: "#1a191e99", over: [${over}] } } });\n`;
const VIEW = `import { Text } from "@keel/ui";\nexport const V = () => <Text fg="on" bg="scrim">x</Text>;\n`;
const run = (over: string) => {
  const dir = keelProject("overlay-over", {
    "topology.ts": TOPOLOGY,
    "modules/m/module.ts": MODULE,
    "modules/m/V.tsx": VIEW,
    "tokens.ts": tokens(over),
  });
  created.push(dir);
  return keel(dir, ["check"]);
};

describe("k.values: an overlay's `over`", () => {
  it(
    'an `over` naming no color token is one E1807 at the `over` key with message `overlay.scrim.over: names no color token "nope"`, with no E1804 or E1817, and exits 1',
    () => {
      const r = run('"nope"');
      const d = r.records.filter((x) => x.kind === "diag");
      expect(d.filter((x) => x.code === "E1807")).toHaveLength(1);
      const line = tokens('"nope"').split("\n")[1] ?? "";
      expect(d.find((x) => x.code === "E1807")).toMatchObject({
        path: "tokens.ts",
        line: 2,
        col: line.indexOf("over:") + 1,
        message: 'overlay.scrim.over: names no color token "nope"',
      });
      expect(d.filter((x) => x.code === "E1804" || x.code === "E1817")).toEqual([]);
      expect(r.status).toBe(1);
    },
    fixedTime(180_000),
  );

  it(
    "an `over` naming a held color token is no E1807",
    () => {
      const r = run('"card"');
      expect(r.records.filter((x) => x.kind === "diag" && x.code === "E1807")).toEqual([]);
    },
    fixedTime(180_000),
  );
});
