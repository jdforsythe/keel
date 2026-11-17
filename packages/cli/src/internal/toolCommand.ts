import { packageBin } from "./packageBin.ts";

/**
 * How to run the tool `bin` of the package `pkg` with `args` from `dir`: Node on the package's real path (`packageBin`)
 * when it is installed there, else `npx --no-install`, which fails with npx's own message.
 */
export function toolCommand(
  dir: string,
  pkg: string,
  bin: string,
  args: readonly string[],
): { readonly cmd: string; readonly args: readonly string[] } {
  const file = packageBin(dir, pkg, bin);
  return file === undefined
    ? { cmd: "npx", args: ["--no-install", bin, ...args] }
    : { cmd: process.execPath, args: [file, ...args] };
}
