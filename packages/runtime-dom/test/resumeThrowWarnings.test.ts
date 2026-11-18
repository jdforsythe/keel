// @vitest-environment happy-dom
// k.claim Client: the resume entry writes every warning `resume` collected to `console.warn`. When an island's resume
// throws past its root Boundary, `resume` rethrows after the other islands resumed; the warnings it collected stay
// readable at `Symbol.for("keel.resumeWarnings")` on `globalThis`, so the entry prints them before rethrowing.
import { afterEach, describe, expect, it } from "vitest";
import { clone, resume, template } from "../src/ops/index.ts";

const KEY = Symbol.for("keel.resumeWarnings");
const T = template('<div data-k-island="Ok"><p>x</p></div>');

afterEach(() => {
  Reflect.deleteProperty(globalThis, KEY);
});

describe("resume rethrowing an island's throw", () => {
  it("leaves the warnings it collected for the entry", () => {
    const host = document.createElement("div");
    host.innerHTML = `<div data-k-island="Gone"></div><div data-k-island="Bad"><p>x</p></div><div data-k-island="Ok"><p>x</p></div><script type="application/json" id="k-state">${JSON.stringify({ stores: {}, islands: { Bad: {}, Ok: {} } })}</script>`;
    let calls = 0;
    // The claim mismatches; the client render returns the island's own host, which cannot replace the server element.
    const Bad = (): Node => {
      calls++;
      if (calls === 1) throw new Error("claim");
      return host;
    };
    const Ok = (): Node => clone(T);
    expect(() => resume(host, { Bad, Ok })).toThrow();
    expect(Reflect.get(globalThis, KEY)).toEqual([
      'E1253 [data-k-island="Gone"] has no compiled component; left static',
    ]);
  });
});
