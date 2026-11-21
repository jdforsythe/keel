// @vitest-environment happy-dom
// k.claim Client and k.errors: a throw while `resume` claims an island is an E1253 warning holding the island id. Its
// thrown text, which can carry data, is in the warning only with `mode: "dev"`, as the root fallback shows a message.
import { describe, expect, it } from "vitest";
import { clone, resume, template } from "../src/ops/index.ts";
import { testCtx } from "./testCtx.ts";

const T = template('<div data-k-island="C"><p>x</p></div>');
const page = (): HTMLElement => {
  const host = document.createElement("div");
  host.innerHTML = `<div data-k-island="C"><p>x</p></div><script type="application/json" id="k-state">${JSON.stringify({ stores: {}, islands: { C: {} } })}</script>`;
  return host;
};
const throwingOnce = () => {
  let calls = 0;
  return (): Node => {
    calls++;
    if (calls === 1) throw new Error("card 4111-1111-1111-1111");
    return clone(T);
  };
};

describe("the warning of a throw while claiming", () => {
  const plain = ['E1253 [data-k-island="C"] the claim threw; re-rendered on the client'];
  it('holds the code and island id, not the thrown text, with mode "production"', () => {
    expect(resume(page(), { C: throwingOnce() }, { ctx: testCtx, mode: "production" }).warnings).toEqual(plain);
  });
  it("holds the code and island id, not the thrown text, with no mode", () => {
    expect(resume(page(), { C: throwingOnce() }, { ctx: testCtx }).warnings).toEqual(plain);
  });

  it('holds the thrown text with mode "dev"', () => {
    const { warnings } = resume(page(), { C: throwingOnce() }, { ctx: testCtx, mode: "dev" });
    expect(warnings).toEqual([
      'E1253 [data-k-island="C"] the claim threw Error: card 4111-1111-1111-1111; re-rendered on the client',
    ]);
  });
});
