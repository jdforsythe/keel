// k.claim Client: the resume entry writes each warning `resume` collected to `console.warn`, also when `resume`
// rethrows an island's throw: the warnings it left at `Symbol.for("keel.resumeWarnings")` print, then the throw goes on.
import { afterEach, describe, expect, it } from "vitest";
import { resumeEntry } from "../src/entry/resumeEntry.ts";

const KEY = Symbol.for("keel.resumeWarnings");

afterEach(() => {
  Reflect.deleteProperty(globalThis, KEY);
});

/** Runs the entry's statements (its imports bound to `resume`) and returns what it printed and threw. */
const run = (resume: () => { warnings: string[] }): { printed: string[]; thrown: unknown } => {
  const body = resumeEntry()
    .split("\n")
    .filter((l) => !l.startsWith("import "))
    .join("\n");
  const printed: string[] = [];
  const console = { warn: (w: string) => void printed.push(w) };
  const document = { body: {}, getElementById: () => null };
  const entry = new Function(
    "bindClientStd",
    "createCtx",
    "resume",
    "stores",
    "components",
    "document",
    "console",
    body,
  );
  try {
    entry(
      () => undefined,
      () => ({}),
      resume,
      () => [],
      {},
      document,
      console,
    );
    return { printed, thrown: undefined };
  } catch (error) {
    return { printed, thrown: error };
  }
};

describe("the resume entry", () => {
  it("prints the warnings resume left before its rethrow, then rethrows", () => {
    const boom = new Error("island threw");
    const { printed, thrown } = run(() => {
      Reflect.set(globalThis, KEY, ['E1253 [data-k-island="a"] has no compiled component; left static']);
      throw boom;
    });
    expect(printed).toEqual(['E1253 [data-k-island="a"] has no compiled component; left static']);
    expect(thrown).toBe(boom);
  });

  it("prints the warnings resume returns", () => {
    expect(run(() => ({ warnings: ["E1253 x"] }))).toEqual({ printed: ["E1253 x"], thrown: undefined });
  });
});
