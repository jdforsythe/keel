import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { e2eError } from "../internal/e2e/e2eError.ts";
import { keelBin } from "../internal/e2e/keelBin.ts";
import { requireE2e } from "../internal/e2e/requireE2e.ts";

/**
 * `keel build` in another project folder (a copy the test edited), resolving once it passed; a failed build is E1737
 * with its first diagnostic lines, since nothing of it can start.
 */
export async function build(project: string): Promise<void> {
  requireE2e("build");
  const dir = resolve(project);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env))
    if (v !== undefined && !/^(?:KEEL_|VITEST)|^(?:NODE_ENV|NODE_OPTIONS|TEST)$/.test(k)) env[k] = v;
  const { code, out } = await new Promise<{ code: number | null; out: string }>((done) => {
    const child = spawn(process.execPath, [keelBin(dir), "build", "--format=compact"], {
      cwd: dir,
      env: { ...env, KEEL_AGENT: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let text = "";
    child.stdout.on("data", (d) => {
      text += String(d);
    });
    child.stderr.on("data", (d) => {
      text += String(d);
    });
    child.once("exit", (c) => done({ code: c, out: text }));
    child.once("error", (e) => done({ code: 1, out: e.message }));
  });
  if (code !== 0) {
    const lines = out.split("\n").filter((l) => l.trim() !== "");
    throw e2eError("E1737", `keel build in ${dir} failed: ${lines.slice(0, 3).join(" | ")}`, { project: dir, lines });
  }
}
