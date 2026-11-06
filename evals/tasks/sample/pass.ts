// True when Counter.tsx exists, `pnpm check` is clean, and the sandbox tests pass.
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const exits0 = (args: string[]): Promise<boolean> =>
  new Promise((resolve) => {
    execFile("pnpm", args, { cwd: root, maxBuffer: 64 * 1024 * 1024 }, (err) => resolve(err === null));
  });

const exists = (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

export default async (): Promise<boolean> => {
  if (!(await exists(join(root, "packages/sandbox/src/Counter.tsx")))) return false;
  if (!(await exits0(["check", "--quiet"]))) return false;
  return exits0(["test", "--quiet", "--filter", "@keel/sandbox"]);
};
