// k.ledger, Ledger "a passing `prove` its body awaits or returns"
// The real `keel` binary over a temp project (OS tmpdir). Each case has its own one-transaction store, so one `keel ledger` run
// reports every case. `prove` is @keel/testing/prove's (k.prove). Seed: 1337 (no property in this file).
// Assumption: a test that names a transaction without a credited `prove` holds the rung `example` (k.ledger, `example`: a passing test references the item).
import { describe, expect, it } from "vitest";
import { ledgerRecord, withProject } from "./ledger-fixture-kinds.ts";
import { keel } from "./test-sim-project.ts";

/** A one-transaction store over `{ on: boolean }` in `packages/m/src/<name>.ts`; the transaction is `<name>Set`, which proves. */
const storeSource = (name: string): string => `import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";

const State = s.object({ on: s.boolean() });
export const ${name} = store(State, { on: false }, { id: "m.${name}" });
export const ${name}Set = transaction(${name}, "m.${name}Set", State, (_state, payload) => ({ on: payload.on }));
`;

/** A store whose transaction breaks its invariant, so `prove` of it rejects E1716. */
const failingSource = (name: string): string => `import { s } from "@keel/schema";
import { invariant, store, transaction } from "@keel/store";

const State = s.object({ n: s.int({ min: 0 }) });
export const ${name} = store(State, { n: 0 }, { id: "m.${name}" });
invariant(${name}, (state) => state.n >= 0);
export const ${name}Set = transaction(${name}, "m.${name}Set", s.object({}), (state) => ({ n: state.n - 1 }));
`;

const head = (name: string): string => `import { prove } from "@keel/testing/prove";
import { expect, it } from "vitest";
import { ${name}Set } from "../src/${name}.ts";
`;

const rejectionHelper = `
const rejection = async (run: () => Promise<unknown>): Promise<unknown> => {
  try {
    await run();
    return undefined;
  } catch (e) {
    return e;
  }
};
`;

type Case = { name: string; proves: boolean; failing?: boolean; body: (n: string) => string; extra?: string };

const cases: readonly Case[] = [
  { name: "awaited", proves: true, body: (n) => `await prove([${n}Set]);` },
  {
    name: "bound",
    proves: true,
    body: (n) => `const r = await prove([${n}Set]);\n  expect(r.proven).toContain("m.${n}Set");`,
  },
  { name: "returned", proves: true, body: (n) => `return prove([${n}Set]);` },
  { name: "caught", proves: false, body: (n) => `await prove([${n}Set]).catch(() => undefined);` },
  {
    name: "trycatch",
    proves: false,
    body: (n) => `try {\n    await prove([${n}Set]);\n  } catch {\n    expect(true).toBe(true);\n  }`,
  },
  {
    name: "rejects",
    proves: false,
    failing: true,
    body: (n) => `await expect(prove([${n}Set])).rejects.toBeDefined();`,
  },
  {
    name: "helper",
    proves: false,
    failing: true,
    extra: rejectionHelper,
    body: (n) => `expect(await rejection(() => prove([${n}Set]))).toBeDefined();`,
  },
  { name: "dangling", proves: false, body: (n) => `prove([${n}Set]);\n  expect(${n}Set).toBeDefined();` },
];

const files = (): Record<string, string> =>
  Object.fromEntries(
    cases.flatMap((c) => [
      [`packages/m/src/${c.name}.ts`, c.failing === true ? failingSource(c.name) : storeSource(c.name)],
      [
        `packages/m/test/${c.name}.test.ts`,
        `${head(c.name)}${c.extra ?? ""}
it("${c.name}", async () => {
  ${c.body(c.name)}
});
`,
      ],
    ]),
  );

describe("k.ledger: a `prove` the body awaits or returns", () => {
  let cached: ReturnType<typeof keel> | undefined;
  const run = () => {
    cached ??= withProject("ledger-prove-awaited", files(), (dir) => keel(dir, ["ledger"]));
    return cached;
  };
  const rungOf = (r: ReturnType<typeof keel>, name: string) =>
    ledgerRecord(r, `packages/m/src/${name}.ts#${name}Set`)?.rung;

  for (const c of cases.filter((x) => x.proves)) {
    it(`a passing test whose body has ${c.name} \`prove\` makes the transaction \`proven\`: ${c.body(c.name).split("\n")[0]}`, () => {
      expect(rungOf(run(), c.name)).toBe("proven");
    }, 60_000);
  }

  for (const c of cases.filter((x) => !x.proves)) {
    it(`a \`prove\` that is ${c.name} (${c.body(c.name).split("\n")[0]}) does not make the transaction \`proven\`; the test only names it`, () => {
      expect(rungOf(run(), c.name)).toBe("example");
    }, 60_000);
  }
});
