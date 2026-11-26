// packageBin and toolCommand: a tool's executable by its real path, also under a `node_modules` that is a link.
import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { describe, expect, it } from "vitest";
import { packageBin } from "../src/internal/packageBin.ts";
import { toolCommand } from "../src/internal/toolCommand.ts";

const tmp = (): string => realpathSync(tempDir("keel-bin-"));
const install = (modules: string, pkg: string, bin: unknown, file: string): void => {
  const dir = join(modules, pkg);
  mkdirSync(join(dir, "bin"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: pkg, bin }));
  writeFileSync(join(dir, file), "");
};

describe("packageBin", () => {
  it("finds a string or record bin at the nearest node_modules above the directory", () => {
    const root = tmp();
    install(join(root, "node_modules"), "vite", { vite: "bin/vite.js" }, "bin/vite.js");
    install(join(root, "node_modules"), "@capacitor/cli", "bin/cap", "bin/cap");
    mkdirSync(join(root, "a", "b"), { recursive: true });
    expect(packageBin(join(root, "a", "b"), "vite", "vite")).toBe(join(root, "node_modules/vite/bin/vite.js"));
    expect(packageBin(root, "@capacitor/cli", "cap")).toBe(join(root, "node_modules/@capacitor/cli/bin/cap"));
  });

  it("resolves through a node_modules that is a link from elsewhere", () => {
    const store = tmp();
    const project = tmp();
    install(store, "vite", { vite: "bin/vite.js" }, "bin/vite.js");
    symlinkSync(store, join(project, "node_modules"));
    expect(packageBin(project, "vite", "vite")).toBe(join(store, "vite/bin/vite.js"));
  });

  it("is undefined when the package, the bin name or the file is missing", () => {
    const root = tmp();
    expect(packageBin(root, "vite", "vite")).toBeUndefined();
    install(join(root, "node_modules"), "vite", { vite: "bin/gone.js" }, "bin/vite.js");
    expect(packageBin(root, "vite", "vite")).toBeUndefined();
    expect(packageBin(root, "vite", "other")).toBeUndefined();
  });
});

describe("toolCommand", () => {
  it("runs Node on the real path when installed, else npx --no-install", () => {
    const root = tmp();
    expect(toolCommand(root, "vite", "vite", ["build"])).toEqual({
      cmd: "npx",
      args: ["--no-install", "vite", "build"],
    });
    install(join(root, "node_modules"), "vite", { vite: "bin/vite.js" }, "bin/vite.js");
    expect(toolCommand(root, "vite", "vite", ["build"])).toEqual({
      cmd: process.execPath,
      args: [join(root, "node_modules/vite/bin/vite.js"), "build"],
    });
  });
});
