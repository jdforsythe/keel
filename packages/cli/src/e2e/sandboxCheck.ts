import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { Diag } from "../internal/Diag.ts";
import { makeDiag } from "../internal/makeDiag.ts";

/** What a Chromium launch throws when the kernel or container refuses the user namespaces its sandbox needs. */
const REFUSED = /No usable sandbox|SUID sandbox|new namespace|user namespace/i;
/** What a user can do as written, safest first (k.e2e-run Browser). */
const FIX =
  "on the host, sysctl kernel.apparmor_restrict_unprivileged_userns=0 (Ubuntu 23.10 and later) or " +
  "sysctl kernel.unprivileged_userns_clone=1 (Debian); in a container, a seccomp profile that allows clone with " +
  "CLONE_NEWUSER, or docker run --security-opt seccomp=unconfined, which lifts every syscall filter from the " +
  "container; last, --no-sandbox, an unsandboxed browser with a warning on every run";

/** The one E1734 of a Chromium that cannot start its sandbox (k.e2e-run Browser), its fix naming the settings. */
const sandboxRefused = (): Diag =>
  makeDiag("E1734", "chromium cannot start its sandbox here", { fix: FIX, see: "k.e2e-run" });

type Launcher = { launch(o: object): Promise<{ close(): Promise<void> }> };
const isLauncher = (v: unknown): v is Launcher =>
  typeof v === "object" && v !== null && typeof Reflect.get(v, "launch") === "function";

/**
 * The sandbox check of `keel test --e2e` (k.e2e-run Browser), before any file runs: Chromium from the project's
 * `playwright-core` (at `at`) launched once, headless, with its sandbox on, then closed. A launch refused for want of
 * user namespaces is `sandboxRefused`; `seam`, the run's `KEEL_E2E_SANDBOX`, at `unavailable` gives the same without
 * launching, and no value
 * of it turns the sandbox off. Any other launch failure is left to the test files, whose own launch reports it. The
 * browser's `HOME` and temporary folders are made in `run`, the run folder.
 */
export async function sandboxCheck(at: string, run: string, seam: string | undefined): Promise<Diag | undefined> {
  if (seam === "unavailable") return sandboxRefused();
  const mod: unknown = createRequire(import.meta.url)(at);
  const ns = typeof mod === "object" && mod !== null ? mod : {};
  const fallback: unknown = Reflect.get(ns, "default");
  const chromium: unknown =
    Reflect.get(ns, "chromium") ??
    (typeof fallback === "object" && fallback !== null ? Reflect.get(fallback, "chromium") : undefined);
  if (!isLauncher(chromium)) return undefined;
  const home = join(run, "sandbox-check");
  const tmp = join(home, "tmp");
  mkdirSync(tmp, { recursive: true });
  const env: Record<string, string> = { HOME: home, TMPDIR: tmp, TMP: tmp, TEMP: tmp };
  for (const k of ["PATH", "LANG", "LC_ALL", "TZ"]) {
    const v = process.env[k];
    if (v !== undefined) env[k] = v;
  }
  // Playwright makes its profile and artifacts folders under the OS temporary folder of this process: the run folder.
  const saved = (["TMPDIR", "TMP", "TEMP"] as const).map((k) => [k, process.env[k]] as const);
  Object.assign(process.env, { TMPDIR: tmp, TMP: tmp, TEMP: tmp });
  try {
    const browser = await chromium.launch({ headless: true, chromiumSandbox: true, env });
    await browser.close();
    return undefined;
  } catch (e) {
    return e instanceof Error && REFUSED.test(e.message) ? sandboxRefused() : undefined;
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) Reflect.deleteProperty(process.env, k);
      else process.env[k] = v;
    }
  }
}
