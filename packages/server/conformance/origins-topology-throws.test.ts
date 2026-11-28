// Spec: k.origins, clause "E1590: `https://*.cdn.example`, `https://cdn.example/img`, `http://cdn.example`, `script: {...}`, reason `''`, a reason with a line break, one of 201 characters, `origins: shared`, 17 origins; `https://cdn.example/`, `https://CDN.example` and `https://cdn.example:443` with the fix `https://cdn.example`; `http://localhost:9000` and `https://cdn.example:8443` are none; `topology()` throws E1590 for `https://cdn.example/`."
// k.origins, Rules "(check, build, dev; `topology()` throws `Error('E1590 <deployable>: ...')`)"
// Seed 1337 (fc.assert below).
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { Origins } from "./origins-support.ts";

const SEED = 1337;
const make = (origins: Origins | undefined) => () =>
  topology({ web: { modules: ["a"], adapter: "node", ...(origins === undefined ? {} : { origins }) } });

/** The message of the Error `fn` throws; fails when it throws nothing or a non-Error. */
function threw(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof Error) return e.message;
    throw new Error("topology() threw a non-Error");
  }
  return "";
}
const E1590 = /^E1590 web: .+/;

describe("k.origins: topology() throws E1590", () => {
  test("`topology()` throws E1590 for `https://cdn.example/`", () => {
    expect(() => make({ img: { "https://cdn.example/": "r" } })()).toThrow(Error);
    expect(threw(make({ img: { "https://cdn.example/": "r" } }))).toMatch(E1590);
  });
  test("`topology()` throws E1590 for the other checks the runtime value can show", () => {
    for (const v of [
      { img: { "https://*.cdn.example": "r" } },
      { img: { "https://cdn.example/img": "r" } },
      { img: { "http://cdn.example": "r" } },
      { script: { "https://cdn.example": "r" } },
      { img: { "https://cdn.example": "" } },
      { img: { "https://cdn.example": "a\nb" } },
      { img: { "https://cdn.example": "x".repeat(201) } },
      { img: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`https://h${i}.example`, "r"])) },
    ]) {
      expect(threw(make(v)), JSON.stringify(v).slice(0, 60)).toMatch(E1590);
    }
  });
  test("`topology()` accepts `http://localhost:9000`, `https://cdn.example:8443`, no `origins` and `origins: {}`", () => {
    for (const v of [
      undefined,
      {},
      { img: {} },
      { img: { "http://localhost:9000": "r" } },
      { img: { "https://cdn.example:8443": "r" } },
    ]) {
      expect(make(v)).not.toThrow();
    }
  });
  test("`topology()` accepts any exact https origin and refuses the same with a path", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,10}$/), (h) => {
        expect(make({ img: { [`https://${h}.example`]: "r" } })).not.toThrow();
        expect(threw(make({ img: { [`https://${h}.example/p`]: "r" } }))).toMatch(E1590);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
