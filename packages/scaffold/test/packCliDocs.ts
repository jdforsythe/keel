import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Vitest global setup: packs `@keel/cli`'s docs (`docs/map.json` and its sections) when they are absent, as a
 * published `@keel/cli` carries them. The agent-files tests run `keel docs` in a project outside the repo, where the
 * map and the skills come from the running `@keel/cli`. The folder stays after the run (git ignores it and no gate reads it), so parallel runs never delete what another needs.
 */
export default function packCliDocs(): () => void {
  const cli = fileURLToPath(new URL("../../cli/", import.meta.url));
  if (existsSync(fileURLToPath(new URL("../../cli/docs/map.json", import.meta.url)))) return () => undefined;
  const r = spawnSync(process.execPath, ["../../tooling/docs-pack.mjs", "--quiet"], { cwd: cli, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`docs-pack failed in @keel/cli: ${r.stdout}${r.stderr}`);
  return () => undefined;
}
