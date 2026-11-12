import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Io } from "../types/Io.ts";
import { applyWrites } from "./applyWrites.ts";
import { hostBuild } from "./hostBuild.ts";
import { readProject } from "./readProject.ts";

/**
 * Binary only: the engine `Io` for this process. Files are loaded per operation scope by the engine (`load`),
 * effects applied under the cwd (`apply`), the disk half of `build` (`hostBuild`); `stream` adds process stdin/stdout for `mcp` and `lsp`.
 */
export function hostIo(stream: boolean): Io {
  const cwd = process.cwd();
  const env = Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
  return {
    cwd,
    env,
    tty: process.stdout.isTTY === true,
    fetch: (url: string, init?: RequestInit) => (init === undefined ? fetch(url) : fetch(url, init)),
    load: (scope) => (scope === "none" ? [] : readProject(cwd, scope)),
    apply: (writes) => applyWrites(cwd, writes),
    build: hostBuild,
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
