// Spec: k.scaffold-shell, clause "In `p`, `shell: 'capacitor'` adds `@keel/std-capacitor`, `@capacitor/core`, `@capacitor/preferences` and `@capacitor/app` to `dependencies` and `@capacitor/cli`, `@capacitor/android` and `@capacitor/ios` to `devDependencies`; with `identity.ts` in the tree, `@capacitor/browser` too."
// k.scaffold-shell, Edits "each in the field and at the version the shell's package declares" (the versions are read from `@keel/std-capacitor`'s own package.json).
import { describe, expect, it } from "vitest";
import { added, declared, p, serverText, shellApply, withIdentity } from "./shell-support.ts";

const INPUT = { shell: "capacitor", id: "com.acme.p" };
const dep = (n: string): string => declared("std-capacitor", "dependencies", n);
const peer = (n: string): string => declared("std-capacitor", "peerDependencies", n);

describe("scaffold shell capacitor", () => {
  it("without identity.ts adds the four dependencies and three devDependencies at the declared versions", () => {
    const before = p();
    const after = shellApply(INPUT, before);
    expect(added(before, after, "dependencies")).toEqual({
      "@keel/std-capacitor": serverText(before),
      "@capacitor/core": dep("@capacitor/core"),
      "@capacitor/preferences": dep("@capacitor/preferences"),
      "@capacitor/app": dep("@capacitor/app"),
    });
    expect(added(before, after, "devDependencies")).toEqual({
      "@capacitor/cli": peer("@capacitor/cli"),
      "@capacitor/android": peer("@capacitor/android"),
      "@capacitor/ios": peer("@capacitor/ios"),
    });
  });

  it("with identity.ts in the tree adds @capacitor/browser too", () => {
    const before = withIdentity(p());
    const after = shellApply(INPUT, before);
    expect(added(before, after, "dependencies")).toEqual({
      "@keel/std-capacitor": serverText(before),
      "@capacitor/core": dep("@capacitor/core"),
      "@capacitor/preferences": dep("@capacitor/preferences"),
      "@capacitor/app": dep("@capacitor/app"),
      "@capacitor/browser": dep("@capacitor/browser"),
    });
    expect(Object.keys(added(before, after, "devDependencies")).sort()).toEqual([
      "@capacitor/android",
      "@capacitor/cli",
      "@capacitor/ios",
    ]);
  });

  it("declares capacitor in topology.ts on web", () => {
    const top = shellApply(INPUT, p()).get("topology.ts") ?? "";
    expect(top).toContain("capacitor");
    expect(top).toContain("com.acme.p");
  });
});
