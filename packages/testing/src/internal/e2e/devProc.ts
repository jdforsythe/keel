import type { Proc } from "./Proc.ts";
import { keelBin } from "./keelBin.ts";
import { spawnProc } from "./spawnProc.ts";

/**
 * `keel dev` in `dir` on a free port as one process of a serve (k.e2e serve `dev`), ready at its first HTTP answer
 * to `GET /`; `env` is the first node deployable's.
 */
export function devProc(
  dir: string,
  name: string,
  env: (port: number) => Readonly<Record<string, string>>,
  readyMs: number,
): Proc {
  return spawnProc({
    name,
    cwd: dir,
    args: (port) => ["--disable-warning=ExperimentalWarning", keelBin(dir), "dev", "--port", String(port)],
    env: (port) => ({ ...env(port), KEEL_AGENT: "1" }),
    readyMs,
    waitListen: false,
  });
}
