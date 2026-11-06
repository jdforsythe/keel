import type { Io } from "../types/Io.ts";
import { readProject } from "./readProject.ts";

/** Binary only: the engine `Io` for this process (fresh project read, string env, stdout TTY flag). */
export function hostIo(withFiles: boolean): Io {
  const cwd = process.cwd();
  const env = Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
  return { cwd, env, tty: process.stdout.isTTY === true, files: withFiles ? readProject(cwd) : [] };
}
