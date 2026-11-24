// Spec: k.scaffold-shell, Conformance "`tauri` then `capacitor` on `web` leaves `shells` with both entries, `tauri` first; `tauri` twice is E1351 the second time, nothing written."
// Spec: k.scaffold-shell, Refusals "The deployable already declares `<shell>`: E1351."
import { describe, expect, it } from "vitest";
import { errText, read, snap } from "./fixtures.ts";
import { p, shell, shellApply, squash } from "./shell-support.ts";

const TAURI = { shell: "tauri", id: "com.acme.p" };
const CAP = { shell: "capacitor", id: "com.acme.p" };

describe("scaffold shell, two kinds in one project", () => {
  it("tauri then capacitor on web leaves shells with both entries, tauri first", () => {
    const out = shellApply(CAP, shellApply(TAURI, p()));
    expect(squash(read(out, "topology.ts"))).toContain(
      `shells:{tauri:{id:"com.acme.p",name:"P"},capacitor:{id:"com.acme.p",name:"P"}}`,
    );
    expect(squash(read(out, "topology.ts")).split("shells:").length).toBe(2);
  });

  it("tauri then capacitor lists both std packages in dependencies", () => {
    const m = read(shellApply(CAP, shellApply(TAURI, p())), "package.json");
    expect(m).toContain("@keel/std-tauri");
    expect(m).toContain("@keel/std-capacitor");
    expect(m).toContain("@tauri-apps/cli");
    expect(m).toContain("@capacitor/cli");
  });

  for (const input of [TAURI, CAP]) {
    it(`${input.shell} twice is E1351 the second time, nothing written`, () => {
      const once = shellApply(input, p());
      const before = snap(once);
      const second = shell(input, once);
      expect(second.ok).toBe(false);
      expect(errText(second)).toContain("E1351");
      expect(snap(once)).toBe(before);
    });
  }

  it("the same kind twice with another id is still E1351", () => {
    const once = shellApply(TAURI, p());
    const second = shell({ shell: "tauri", id: "com.acme.other" }, once);
    expect(errText(second)).toContain("E1351");
  });
});
