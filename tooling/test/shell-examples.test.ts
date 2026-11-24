import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scaffold } from "../../packages/scaffold/src/index.ts";

const repo = path.join(import.meta.dirname, "..", "..");

/** `keel scaffold project <name> --workspace`, then `keel scaffold shell <shell> --id <id>`. */
function replay(name: string, shell: string, id: string): ReadonlyMap<string, string> {
  const project = scaffold("project", { name, workspace: true }, new Map());
  if (!project.ok) throw new Error(project.error.message);
  const out = scaffold("shell", { shell, id }, project.value.files);
  if (!out.ok) throw new Error(out.error.message);
  return out.value.files;
}

describe("the native examples are a scaffolded project and one scaffold shell", () => {
  for (const [example, shell, id] of [
    ["native-tauri", "tauri", "dev.keel.nativetauri"],
    ["native-capacitor", "capacitor", "dev.keel.nativecapacitor"],
  ]) {
    it(`examples/${example}: topology.ts and package.json byte for byte`, () => {
      const files = replay(example, shell, id);
      for (const file of ["topology.ts", "package.json"])
        expect(files.get(file), file).toBe(readFileSync(path.join(repo, "examples", example, file), "utf8"));
    });
  }
});
