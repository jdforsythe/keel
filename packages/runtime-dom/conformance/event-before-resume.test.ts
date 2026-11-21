// @vitest-environment happy-dom
// Spec: k.runtime, clause "An event fired before its island resumes is applied exactly once after resume."
// ASSUMPTION: resume(root, { [componentId]: Component }, { ctx }).
import { createCtx } from "@keel/ctx";
import { resume } from "@keel/runtime-dom/ops";
import { describe, expect, it } from "vitest";
import { COUNTER_HTML, Counter, KSTATE, click, flush } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

describe("k.runtime: an event fired before its island resumes is applied exactly once after resume", () => {
  it("an event fired before its island resumes is applied exactly once after resume", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    host.innerHTML = COUNTER_HTML + KSTATE;
    const btn = host.querySelector("#inc");
    if (btn === null) throw new Error("no #inc");
    click(btn);
    resume(host, { Counter }, { ctx: simCtx });
    await flush();
    expect(btn.textContent).toBe("4");
    await flush();
    expect(btn.textContent).toBe("4");
    host.remove();
  });
});
