// Spec: k.ledger, clause "A passing `prove` makes the transactions it names `proven`."
// The real `keel` binary over a temp project (OS tmpdir). Each case proves its own one-transaction store, so one
// `keel ledger` run reports every case. `prove` is @keel/testing/prove's (k.prove). Seed: 1337 (no property in this file).
import { describe, expect, it } from "vitest";
import { ledgerRecord, withProject } from "./ledger-fixture-kinds.ts";
import { keel } from "./test-sim-project.ts";

/** A one-transaction store over `{ on: boolean }` in `packages/m/src/<name>.ts`; the transaction is `<name>Set`. */
const storeSource = (name: string): string => `import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";

const State = s.object({ on: s.boolean() });
export const ${name} = store(State, { on: false }, { id: "m.${name}" });
export const ${name}Set = transaction(${name}, "m.${name}Set", State, (_state, payload) => ({ on: payload.on }));
`;

const proveTest = (name: string): string => `import { prove } from "@keel/testing/prove";
import { it } from "vitest";
import { ${name}Set } from "../src/${name}.ts";

it("proves ${name}", async () => {
  await prove([${name}Set]);
});
`;

const namedTest = (name: string): string => `import { expect, it } from "vitest";
import { ${name}Set } from "../src/${name}.ts";

it("names ${name}", () => {
  expect(${name}Set).toBeDefined();
});
`;

const files = (): Record<string, string> => ({
  "packages/m/src/proved.ts": storeSource("proved"),
  "packages/m/test/proved.test.ts": proveTest("proved"),
  "packages/m/src/named.ts": storeSource("named"),
  "packages/m/test/named.test.ts": namedTest("named"),
});

describe("k.ledger: `prove` evidence", () => {
  it.skip("A passing `prove` makes the transactions it names `proven`.", () => {
    const run = withProject("ledger-prove", files(), (dir) => keel(dir, ["ledger"]));
    expect(ledgerRecord(run, "packages/m/src/proved.ts#provedSet")?.rung).toBe("proven");
    expect(ledgerRecord(run, "packages/m/src/named.ts#namedSet")?.rung).toBe("example");
  }, 60_000);

  it.skip("the `proven` evidence of a passing `prove` lists the Z3 version", () => {
    const record = withProject("ledger-prove-evidence", files(), (dir) =>
      ledgerRecord(keel(dir, ["ledger"]), "packages/m/src/proved.ts#provedSet"),
    );
    const evidence = record?.evidence;
    expect(typeof evidence).toBe("string");
    expect(String(evidence)).toMatch(/z3/i);
    expect(String(evidence)).toMatch(/\d+\.\d+\.\d+/);
  }, 60_000);
});
