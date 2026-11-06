// @vitest-environment happy-dom
// Spec: k.testing Harness and Properties; k.errors (root Boundary). Seed: 1337.
import { createCtx } from "@keel/ctx";
import { properties, render } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { Fragile, Labels } from "./support/components.ts";

const sim = () => createCtx({ mode: "sim", seed: 1337 });

describe("render surfaces throws the root Boundary caught", () => {
  it("a throwing render fails with keel.unexpected naming the message", () => {
    expect(() => render(Fragile, { props: { n: -1 }, ctx: sim() })).toThrow(/^keel\.unexpected .*negative -1/);
  });

  it("a passing render leaves nothing mounted after dispose", () => {
    const t = render(Fragile, { props: { n: 1 }, ctx: sim() });
    expect(t.find("fragile").text).toBe("ok");
    t.dispose();
    expect(document.body.childElementCount).toBe(0);
  });
});

describe("properties(component)", () => {
  it("fails with E1704, the seed, and the shrunk props when a generated render throws", async () => {
    const e = await properties(Fragile, { runs: 100, seed: 1337 }).then(
      () => undefined,
      (x: unknown) => x,
    );
    const msg = e instanceof Error ? e.message : "";
    expect(msg).toMatch(/^E1704 component: keel\.unexpected .* \(seed 1337, run \d+, shrunk\)\n {2}props: \{"n":-1\}$/);
  });

  it("passes for a component whose generated renders are accessible and deterministic", async () => {
    expect(await properties(Labels, { runs: 30, seed: 1337 })).toEqual({ seed: 1337, runs: 30 });
  });
});
