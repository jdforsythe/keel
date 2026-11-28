// Spec: k.ledger, clause "A passing `explore` with `from`, `payloads` or `depth` makes the transactions it names `exhaustive`; one with none of them makes them `proven`; one whose options are an imported variable gives `exhaustive`."
// k.ledger, Ledger "`exhaustive`: a passing `explore` (k.model) given `from`, `payloads` or `depth`; evidence lists a literal `depth`."
// The real `keel` binary over a temp project (OS tmpdir). Each case explores its own one-transaction store, so one
// `keel ledger` run reports every case. `explore` is @keel/testing's (k.model). Seed: 1337 (no property in this file).
import { fixedTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";
import { ledgerRecord, withProject } from "./ledger-fixture-kinds.ts";
import { keel } from "./test-sim-project.ts";

const OPTIONS = "packages/m/test/options.ts";

/** A one-transaction store over `{ on: boolean }` in `packages/m/src/<name>.ts`; the transaction is `<name>Set`. */
const storeSource = (name: string): string => `import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";

const State = s.object({ on: s.boolean() });
export const ${name} = store(State, { on: false }, { id: "m.${name}" });
export const ${name}Set = transaction(${name}, "m.${name}Set", State, (_state, payload) => ({ on: payload.on }));
`;

const exploreTest = (name: string, call: string, imports = ""): string => `import { explore } from "@keel/testing";
import { expect, it } from "vitest";
import { ${name}Set } from "../src/${name}.ts";
${imports}
it("explores ${name}", () => {
  const result = ${call.replaceAll("$T", `${name}Set`)};
  expect(result.states.length).toBeGreaterThan(0);
});
`;

type Case = { name: string; call: string; imports?: string; rung: string };
const CASES: readonly Case[] = [
  { name: "withFrom", call: "explore([$T], { from: { on: false } })", rung: "exhaustive" },
  {
    name: "withPayloads",
    call: 'explore([$T], { payloads: { "m.withPayloadsSet": [{ on: true }] } })',
    rung: "exhaustive",
  },
  { name: "withDepth", call: "explore([$T], { depth: 2 })", rung: "exhaustive" },
  { name: "closedBare", call: "explore([$T])", rung: "proven" },
  { name: "closedMax", call: "explore([$T], { maxStates: 100 })", rung: "proven" },
  {
    name: "imported",
    call: "explore([$T], OPTIONS)",
    imports: 'import { OPTIONS } from "./options.ts";',
    rung: "exhaustive",
  },
];

const files = (): Record<string, string> => {
  const out: Record<string, string> = { [OPTIONS]: "export const OPTIONS = { maxStates: 100 };\n" };
  for (const c of CASES) {
    out[`packages/m/src/${c.name}.ts`] = storeSource(c.name);
    out[`packages/m/test/${c.name}.test.ts`] = exploreTest(c.name, c.call, c.imports);
  }
  return out;
};

describe("k.ledger: `explore` evidence", () => {
  it(
    "A passing `explore` with `from`, `payloads` or `depth` makes the transactions it names `exhaustive`; one with none of them makes them `proven`; one whose options are an imported variable gives `exhaustive`.",
    () => {
      const run = withProject("ledger-explore", files(), (dir) => keel(dir, ["ledger"]));
      for (const c of CASES) {
        expect(ledgerRecord(run, `packages/m/src/${c.name}.ts#${c.name}Set`)?.rung, c.name).toBe(c.rung);
      }
    },
    fixedTime(60_000),
  );

  it(
    "`explore` with a literal `depth` lists that depth in the `exhaustive` evidence",
    () => {
      const record = withProject("ledger-explore-depth", files(), (dir) =>
        ledgerRecord(keel(dir, ["ledger"]), "packages/m/src/withDepth.ts#withDepthSet"),
      );
      expect(record?.evidence).toBe("exhaustive depth 2 packages/m/test/withDepth.test.ts");
    },
    fixedTime(60_000),
  );
});
