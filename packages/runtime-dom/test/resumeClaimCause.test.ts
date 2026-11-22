// @vitest-environment happy-dom
// k.errors: thrown text stays out of production output; a test harness is no production. An island whose claim throws is a
// mismatch (k.runtime E1253); its warning names the thrown error in dev and on a ctx a test harness renders with, and
// only "the claim threw" otherwise.
import { createCtx } from "@keel/ctx";
import { describe, expect, it } from "vitest";
import { harnessed } from "../src/internal/harnessed.ts";
import { clone, resume, template } from "../src/ops/index.ts";

const T = template('<div data-k-island="Bad"><p>x</p></div>');

function warningsOn(harness: boolean): string[] {
  const ctx = createCtx({ mode: "sim", seed: 1 });
  if (harness) harnessed().add(ctx);
  const host = document.createElement("div");
  host.innerHTML = `<div data-k-island="Bad"><p>x</p></div><script type="application/json" id="k-state">${JSON.stringify({ stores: {}, islands: { Bad: {} } })}</script>`;
  let calls = 0;
  const Bad = (): Node => {
    calls++;
    if (calls === 1) throw new Error("store shopping.copy: id already in use");
    return clone(T);
  };
  return resume(host, { Bad }, { ctx }).warnings;
}

describe("a claim's throw in the resume warning", () => {
  it("names the cause on a harness ctx", () => {
    const [w] = warningsOn(true);
    expect(w).toContain("E1253");
    expect(w).toContain("the claim threw Error: store shopping.copy: id already in use");
  });
  it("keeps the cause out on any other ctx", () => {
    const [w] = warningsOn(false);
    expect(w).toContain("the claim threw");
    expect(w).not.toContain("shopping.copy");
  });
});
