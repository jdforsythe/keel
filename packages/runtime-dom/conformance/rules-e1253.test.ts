// @vitest-environment happy-dom
// Spec: k.runtime Rules E1253. ASSUMPTION: resume(root, { [componentId]: Component }) returns { warnings: unknown[] }.
import { resume } from "@keel/runtime-dom/ops";
import { describe, expect, it } from "vitest";
import { Counter, KSTATE, click, flush } from "./fixtures.ts";

describe("k.runtime: E1253 server HTML does not match the compiled structure at resume", () => {
  it("E1253 resume against mismatched HTML re-renders that island on the client and emits a dev warning", async () => {
    const host = document.createElement("div");
    host.innerHTML = '<div data-k-island="Counter"><span>3</span></div>' + KSTATE;
    const { warnings } = resume(host, { Counter });
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(warnings)).toContain("E1253");
    const btn = host.querySelector("#inc");
    expect(btn?.textContent).toBe("3");
    if (btn === null) throw new Error("island not re-rendered");
    click(btn);
    await flush();
    expect(btn.textContent).toBe("4");
  });
});
