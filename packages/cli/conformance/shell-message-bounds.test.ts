// Spec: k.shell, Conformance "`keel check` with a stub `plugins` entry `{ plugin: '@aaaaaaaa/bbbbbbbb', version: '10.20.30', need }`, `need` 24 `n`s: one E1572, `web: tauri needs @aaaaaaaa/bbbbbbbb 10.20.30 (<need>)` (71 units). `keel build --target tauri` with a `tools` entry of `tool` 30 `t`s, `need` 30 `n`s: one E1575, `<tool> missing or too old: needs <need>` (87)."
// Spec: k.shell, Plugins "`plugin` at the exact `version`, `need` what uses it, the three at most 50 characters together."
// Spec: k.shell, Rules "E1575 a shell build's tool missing or too old, `<tool> missing or too old: needs <need>`, the two at most 60 characters together"
// Seed: 1337 (the split of each bound between its texts is generated; the projects are otherwise fixed).
// Over a stub `@keel/std-tauri` (`shell-stub.ts`). ASSUMPTION: "(71 units)" and "(87)" are the length of the diag's whole `message`, which a clip (k.check Diagnostics) would end with `...`.
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SEED, SLOW, cleanup, run, setStub, stubProject, withCode } from "./shell-stub.ts";

let dir = "";
beforeAll(() => {
  dir = stubProject();
}, SLOW);
afterAll(() => cleanup(dir));

const FIT = 89;

describe("k.shell: E1572 and E1575 messages at their bounds", () => {
  test(
    "`keel check` with a stub `plugins` entry `@aaaaaaaa/bbbbbbbb` `10.20.30` and a `need` of 24 `n`s is one E1572, `web: tauri needs @aaaaaaaa/bbbbbbbb 10.20.30 (<need>)`, 71 units",
    () => {
      const n = "n".repeat(24);
      setStub(dir, { plugins: [{ plugin: "@aaaaaaaa/bbbbbbbb", version: "10.20.30", need: n }] });
      const found = withCode(run(dir, ["check"]), "E1572");
      expect(found).toHaveLength(1);
      const message = String(found[0]?.message);
      expect(message).toBe(`web: tauri needs @aaaaaaaa/bbbbbbbb 10.20.30 (${n})`);
      expect(message).toHaveLength(71);
    },
    SLOW,
  );

  test(
    "`keel build --target tauri` with a `tools` entry of a `tool` of 30 `t`s and a `need` of 30 `n`s is one E1575, `<tool> missing or too old: needs <need>`, 87 units",
    () => {
      const tool = "t".repeat(30);
      const need = "n".repeat(30);
      setStub(dir, { tools: [{ tool, need }] });
      const found = withCode(run(dir, ["build", "--target", "tauri"]), "E1575");
      expect(found).toHaveLength(1);
      const message = String(found[0]?.message);
      expect(message).toBe(`${tool} missing or too old: needs ${need}`);
      expect(message).toHaveLength(87);
    },
    SLOW,
  );

  test(
    "an E1572 whose `plugin`, `version` and `need` hold 50 characters together is its whole template, at most 89 units and not clipped",
    () => {
      const split = fc
        .tuple(fc.integer({ min: 4, max: 22 }), fc.integer({ min: 5, max: 10 }))
        .map(([plugin, version]) => ({ plugin, version, need: 50 - plugin - version }));
      fc.assert(
        fc.property(split, ({ plugin, version, need }) => {
          const p = `@${"a".repeat(1)}/${"b".repeat(plugin - 3)}`;
          const v = "1".repeat(version);
          const n = "n".repeat(need);
          expect(p.length + v.length + n.length).toBe(50);
          setStub(dir, { plugins: [{ plugin: p, version: v, need: n }] });
          const found = withCode(run(dir, ["check"]), "E1572");
          expect(found).toHaveLength(1);
          const message = String(found[0]?.message);
          expect(message).toBe(`web: tauri needs ${p} ${v} (${n})`);
          expect(message.length).toBeLessThanOrEqual(FIT);
          expect(message.endsWith("...")).toBe(false);
        }),
        { seed: SEED, numRuns: 5 },
      );
    },
    SLOW,
  );

  test(
    "an E1575 whose `tool` and `need` hold 60 characters together is its whole template, at most 89 units and not clipped",
    () => {
      const split = fc.integer({ min: 1, max: 59 });
      fc.assert(
        fc.property(split, (toolLength) => {
          const tool = "t".repeat(toolLength);
          const need = "n".repeat(60 - toolLength);
          setStub(dir, { tools: [{ tool, need }] });
          const found = withCode(run(dir, ["build", "--target", "tauri"]), "E1575");
          expect(found).toHaveLength(1);
          const message = String(found[0]?.message);
          expect(message).toBe(`${tool} missing or too old: needs ${need}`);
          expect(message.length).toBeLessThanOrEqual(FIT);
          expect(message.endsWith("...")).toBe(false);
        }),
        { seed: SEED, numRuns: 5 },
      );
    },
    SLOW,
  );
});
