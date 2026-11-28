import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Io } from "../types/Io.ts";
import { applyWrites } from "./applyWrites.ts";
import { discardDirs } from "./discardDirs.ts";
import { hostDocs } from "./hostDocs.ts";
import { readProject } from "./readProject.ts";

/**
 * Binary only: the engine `Io` for this process. Files are loaded per operation scope by the engine (`load`),
 * effects applied under the cwd (`apply`), a failed build's `dist/<name>/` removed (`discard`), the disk half of `build` and a scaffold's refresh (`hostBuild`), the
 * host side of `build --target` (`hostShell`); `stream` adds process stdin/stdout for `mcp` and `lsp`.
 */
export function hostIo(stream: boolean): Io {
  const cwd = process.cwd();
  const env = Object.fromEntries(
    Object.entries(process.env).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  );
  return {
    cwd,
    env,
    tty: process.stdout.isTTY === true,
    fetch: (url: string, init?: RequestInit) => (init === undefined ? fetch(url) : fetch(url, init)),
    load: (scope) =>
      scope === "none"
        ? []
        : scope === "docs"
          ? hostDocs(cwd, scope)
          : [...readProject(cwd, scope), ...hostDocs(cwd, scope)],
    apply: (writes) => applyWrites(cwd, writes),
    discard: (dirs) => discardDirs(cwd, dirs),
    // Loaded only when a build or a scaffold's refresh runs: it brings in vite and vitest.
    build: async (dir, frozen) => (await import("./hostBuild.ts")).hostBuild(dir, false, frozen === true),
    refresh: async (dir) => (await import("./hostBuild.ts")).hostBuild(dir, true),
    // Behind its own entry, loaded only for `--target` (`@keel/cli` size budget).
    shell: async () => (await import("@keel/cli/shell")).hostShell,
    read: (path) => {
      try {
        return readFileSync(resolve(cwd, path), "utf8");
      } catch {
        return undefined;
      }
    },
    ...(stream
      ? {
          stdin: process.stdin,
          emit: (text: string) => void process.stdout.write(text),
        }
      : {}),
  };
}
