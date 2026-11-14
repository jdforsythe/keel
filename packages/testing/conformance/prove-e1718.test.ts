// Spec: k.prove, Conformance "Without `z3-solver`, `prove` rejects E1718."
// Spec: k.prove, Rules "E1718 the optional peer dependency `z3-solver` is not installed (fix adds it to `devDependencies`)."
// Seed: 1337. The package is made absent by mocking its import to fail as an uninstalled package does.
import { afterEach, describe, expect, it, vi } from "vitest";

const SEED = 1337;
const LONG = 120_000;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const codeOf = (e: unknown): string | undefined => (isRecord(e) && typeof e.code === "string" ? e.code : undefined);
const messageOf = (e: unknown): string => (isRecord(e) && typeof e.message === "string" ? e.message : String(e));
/** What the promise rejected with, or undefined when it resolved. */
const rejection = async (run: () => Promise<unknown>): Promise<unknown> => {
  try {
    await run();
    return undefined;
  } catch (e) {
    return e ?? new Error("rejected with a falsy value");
  }
};
/** The JSON on the line after the first line of the message. */
const jsonLine = (e: unknown): unknown => {
  const line = messageOf(e).split("\n")[1];
  if (line === undefined) throw new Error("fixture: no line after the first line of the message");
  return JSON.parse(line);
};
/** Every value stored under `key` anywhere in `value`. */
const valuesAt = (value: unknown, key: string): unknown[] => {
  if (Array.isArray(value)) return value.flatMap((v) => valuesAt(v, key));
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([k, v]) => (k === key ? [v, ...valuesAt(v, key)] : valuesAt(v, key)));
};

afterEach(() => {
  vi.doUnmock("z3-solver");
  vi.resetModules();
});

describe("k.prove: E1718", () => {
  it(
    "without z3-solver, prove rejects E1718 naming the package",
    async () => {
      vi.resetModules();
      vi.doMock("z3-solver", () => {
        throw new Error("Cannot find package 'z3-solver'");
      });
      const { scope } = await import("@keel/reactive");
      const { s } = await import("@keel/schema");
      const { invariant, store, transaction } = await import("@keel/store");
      const { prove } = await import("@keel/testing/prove");
      let inc: Parameters<typeof prove>[0][number] | undefined;
      scope(() => {
        const st = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: "noz3.count" });
        invariant(st, (state) => state.n >= 0);
        inc = transaction(st, "noz3.inc", s.object({}), (state) => ({ n: state.n + 1 }));
      });
      if (inc === undefined) throw new Error("fixture: scope did not run");
      const e = await rejection(() => prove([inc]));
      expect(codeOf(e)).toBe("E1718");
      expect(messageOf(e)).toContain("z3-solver");
    },
    LONG,
  );
});
